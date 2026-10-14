// Autocity Usados (Córdoba, Río Cuarto, San Luis, Villa María).
// El sitio bloquea a los lectores simples, así que se recorre con un navegador real (Playwright).
// Solo se abren las fichas de los autos nuevos; el resto reutiliza las fotos de la lectura anterior.
export const agencia = { id: 'autocity', nombre: 'Autocity Usados', ciudad: 'Córdoba', web: 'https://autocity.com.ar/catalogo/usados/' };

const BASE = 'https://autocity.com.ar/catalogo/usados/';
const SUCURSALES = { 'cordoba': ['Córdoba', 'Córdoba'], 'rio-cuarto': ['Río Cuarto', 'Córdoba'], 'villa-maria': ['Villa María', 'Córdoba'], 'san-luis': ['San Luis', 'San Luis'] };
const MAX_FICHAS = 120; // por lectura; si hay más autos nuevos, se completan en la siguiente
const titulo = (s) => String(s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function precio(txt) {
  const usd = /U\$S|USD|US\$/i.test(txt || '');
  const v = parseInt(String(txt || '').replace(/[^\d]/g, ''), 10);
  return { valor: v > 0 ? v : null, moneda: usd ? 'USD' : 'ARS' };
}

export function armar(t) {
  const cats = t.clases.filter(c => c.startsWith('product_cat-')).map(c => c.slice(12));
  const marcaSlug = (t.url.match(/\/usados\/m-([^/]+)\//) || [])[1] || '';
  const marca = titulo(marcaSlug).replace(/^Bmw$/, 'BMW').replace(/^Ds /, 'DS ').replace(/^Byd$/, 'BYD').replace(/^Mg$/, 'MG').replace(/^Ram$/, 'RAM');
  const h3 = t.h3.trim();
  const modelo = h3.toLowerCase().startsWith(marca.toLowerCase() + ' ') ? h3.slice(marca.length).trim() : h3;
  const anioKm = t.items.find(x => /\d{4}\s*\|/.test(x)) || '';
  const anio = parseInt((anioKm.match(/(19|20)\d\d/) || [])[0], 10) || null;
  const km = parseInt((anioKm.split('|')[1] || '').replace(/\D/g, ''), 10);
  const comb = (t.items.find(x => /^Combustible/i.test(x)) || '').replace(/^Combustible\s*/i, '');
  const caja = (t.items.find(x => /^Transmisi/i.test(x)) || '').replace(/^Transmisi[oó]n\s*/i, '');
  const suc = Object.keys(SUCURSALES).find(k => cats.includes(k));
  const p = precio(t.precio);
  return {
    id: 'autocity-' + (t.dataId || t.url.split('/').filter(Boolean).pop()),
    tipo: 'auto', marca, modelo, version: t.version.trim(), anio, km: Number.isFinite(km) ? km : null,
    combustible: comb, caja: /autom/i.test(caja) ? 'Automática' : caja ? 'Manual' : '', color: '', equipamiento: '',
    precio: p.valor, precio_sin_imp: null, moneda: p.moneda,
    fotos: /cdn\.asofix\.com/.test(t.foto) ? [t.foto.replace('/products/mini-', '/products/th-')] : [],
    url: t.url, sucursal: suc ? SUCURSALES[suc][0] : '', provincia: suc ? SUCURSALES[suc][1] : 'Córdoba',
    oportunidad: cats.some(c => /oportunidad/.test(c)),
    publicado: null, modificado: null,
  };
}

export async function leer(previos = []) {
  const { chromium } = await import('playwright');
  const navegador = await chromium.launch();
  try {
    const ctx = await navegador.newContext({ locale: 'es-AR', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36' });
    await ctx.route(/\.(woff2?|ttf|mp4|webm)$|google|facebook|hotjar|doubleclick|clarity/, r => r.abort());
    const p = await ctx.newPage();
    const tarjetas = [];
    let paginas = 1;
    for (let n = 1; n <= paginas && n <= 60; n++) {
      await p.goto(n === 1 ? BASE : `${BASE}page/${n}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await p.waitForSelector('li.product a[href*="/catalogo/usados/m-"]', { timeout: 60000 });
      if (n === 1) {
        const total = parseInt(((await p.innerText('body')).match(/(\d+)\s+resultados/) || [])[1], 10) || 0;
        paginas = Math.max(1, Math.ceil(total / 12));
      }
      tarjetas.push(...await p.$$eval('li.product', lis => lis.map(li => {
        const a = li.querySelector('a[href*="/catalogo/usados/"]'); const img = li.querySelector('img');
        return {
          url: a ? a.href : '', dataId: a ? a.getAttribute('data-id') : '', clases: [...li.classList],
          foto: img ? (img.getAttribute('data-src') || img.src) : '', h3: li.querySelector('h3')?.textContent || '',
          version: li.querySelector('.carousel-autocity-card-description p')?.textContent || '',
          items: [...li.querySelectorAll('.carousel-autocity-card-description li')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
          precio: li.querySelector('.carousel-autocity-card-precio h2')?.textContent || '',
        };
      })));
      await p.waitForTimeout(800);
    }
    const vistos = new Set(), autos = [];
    for (const t of tarjetas) { if (!t.url || vistos.has(t.url)) continue; vistos.add(t.url); autos.push(armar(t)); }

    // Fichas: galería completa y color, solo para autos nuevos o sin galería
    const anteriores = new Map(previos.map(a => [a.id, a]));
    let abiertas = 0;
    for (const a of autos) {
      const prev = anteriores.get(a.id);
      if (prev && prev.fotos?.length > 1) { a.fotos = prev.fotos; a.color = prev.color || ''; continue; }
      if (abiertas >= MAX_FICHAS) continue;
      abiertas++;
      try {
        await p.goto(a.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await p.waitForSelector('.ac-product-title', { timeout: 30000 });
        const f = await p.evaluate(() => {
          const urls = [...document.querySelectorAll('img')].map(i => i.getAttribute('data-src') || i.src).filter(u => /cdn\.asofix\.com\/.+\/products\/th-/.test(u));
          const linea = document.querySelector('.ac-product-short-desc.secondOne')?.textContent || '';
          return { urls: [...new Set(urls)], color: (linea.split('|')[2] || '').trim() };
        });
        if (f.urls.length) a.fotos = f.urls;
        a.color = f.color;
      } catch (e) { /* se conserva la foto de la tarjeta */ }
      await p.waitForTimeout(500);
    }
    console.log(`  Autocity: ${autos.length} autos, ${abiertas} fichas abiertas`);
    return autos;
  } finally { await navegador.close(); }
}
