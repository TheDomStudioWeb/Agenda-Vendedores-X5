// Maipú Usados (Córdoba) — lee el stock desde la API pública de WordPress del sitio.
export const agencia = { id: 'maipu', nombre: 'Maipú Usados', ciudad: 'Córdoba', web: 'https://maipuusados.com.ar/modelos/' };

const API = 'https://maipuusados.com.ar/wp-json/wp/v2/posts';
const CAMPOS = 'id,slug,link,date,modified,title,content,class_list,jetpack_featured_media_url';
const UA = { 'User-Agent': 'Mozilla/5.0 (X5 Radar de usados)' };

const limpiar = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#8211;/g, '-').replace(/&amp;/g, '&')
  .replace(/&#0?39;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

function precio(txt) {
  if (!txt) return { valor: null, moneda: null };
  const usd = /U\$S|USD|US\$/i.test(txt);
  const n = txt.replace(/[^\d,\.]/g, '').replace(/[\.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const v = parseFloat(n);
  return Number.isFinite(v) && v > 0 ? { valor: Math.round(v), moneda: usd ? 'USD' : 'ARS' } : { valor: null, moneda: null };
}

export function parsear(post) {
  const html = post.content?.rendered || '';
  const cuerpo = html.split(/Veh[ií]culos similares/i)[0];
  // Fotos: las del primer carrusel, en orden y sin repetir
  const ini = cuerpo.indexOf('image-carousel');
  const fin = ini >= 0 ? cuerpo.indexOf('swiper-pagination', ini) : -1;
  const carrusel = ini >= 0 ? cuerpo.slice(ini, fin > 0 ? fin : undefined) : '';
  const fotos = [...new Set([...carrusel.matchAll(/class="swiper-slide-image"[^>]*src="([^"]+)"/g)].map(m => m[1]))];
  if (!fotos.length && post.jetpack_featured_media_url) fotos.push(post.jetpack_featured_media_url);

  // Encabezados en orden: año, "-", km, modelo, versión, precio, precio sin impuestos
  const titulos = [...cuerpo.matchAll(/class="elementor-heading-title[^"]*"[^>]*>([\s\S]*?)<\/(?:p|h\d|span|div)>/g)].map(m => limpiar(m[1]));
  const porId = (id) => { const m = cuerpo.match(new RegExp(`id="${id}"[\\s\\S]*?elementor-heading-title[^>]*>([\\s\\S]*?)<\\/`)); return m ? limpiar(m[1]) : ''; };
  const anio = parseInt(titulos.find(t => /^(19|20)\d\d$/.test(t)) || '', 10) || null;
  const kmTxt = porId('kilometros');
  const iH3 = cuerpo.search(/<h3 class="elementor-heading-title/);
  const modeloH3 = iH3 >= 0 ? limpiar(cuerpo.slice(iH3).match(/<h3[^>]*>([\s\S]*?)<\/h3>/)[1]) : limpiar(post.title?.rendered || '');
  const iModelo = titulos.indexOf(modeloH3);
  const version = iModelo >= 0 && titulos[iModelo + 1] && !/^(U\$S|\$)?\s*[\d\.,\s]+$/.test(titulos[iModelo + 1]) ? titulos[iModelo + 1] : '';
  const p1 = precio(porId('precio')), p2 = precio(porId('precio-impuestos'));

  // Ficha técnica en texto plano
  const texto = limpiar(cuerpo);
  const campo = (et) => { const m = texto.match(new RegExp(et + ':\\s*(.+?)(?=\\s+(?:Marca|Kilometraje|Combustible|Transmisi[oó]n|Color|Incluye|Ver legales|FINANCIACIONES):|\\s+Ver legales|$)', 'i')); return m ? m[1].trim() : ''; };
  const km = parseInt((campo('Kilometraje') || kmTxt).replace(/\D/g, ''), 10);
  const clases = post.class_list || [];
  const tipo = clases.includes('category-motos') ? 'moto' : clases.includes('category-autos') ? 'auto' : 'otro';

  return {
    id: `maipu-${post.id}`,
    tipo,
    marca: campo('Marca'),
    modelo: modeloH3,
    version,
    anio,
    km: Number.isFinite(km) ? km : null,
    combustible: campo('Combustible'),
    caja: campo('Transmisi[oó]n'),
    color: campo('Color'),
    equipamiento: campo('Incluye'),
    precio: p1.valor, precio_sin_imp: p2.valor, moneda: p1.moneda || p2.moneda || 'ARS',
    fotos,
    url: post.link,
    publicado: post.date, modificado: post.modified,
    _texto: (!version || !campo('Marca')) ? texto.slice(0, 500) : undefined,
  };
}

export async function leer() {
  const autos = [];
  for (let pagina = 1, total = 1; pagina <= total; pagina++) {
    const r = await fetch(`${API}?per_page=100&page=${pagina}&_fields=${CAMPOS}`, { headers: UA, signal: AbortSignal.timeout(90000) });
    if (!r.ok) throw new Error(`API respondió ${r.status} en la página ${pagina}`);
    total = parseInt(r.headers.get('x-wp-totalpages') || '1', 10);
    for (const post of await r.json()) autos.push(parsear(post));
  }
  return autos.filter(a => a.tipo === 'auto');
}
