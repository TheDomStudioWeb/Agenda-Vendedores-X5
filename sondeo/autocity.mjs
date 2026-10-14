import { chromium } from 'playwright';
import fs from 'node:fs';
const out = { paginas: [], apis: [] };
const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'es-AR', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
p.on('response', async r => { const u = r.url(); const ct = r.headers()['content-type'] || ''; if (/json/.test(ct) && !/google|facebook|hotjar|clarity|doubleclick/.test(u)) { let body = ''; try { body = (await r.text()).slice(0, 1500); } catch {} out.apis.push({ u, status: r.status(), body }); } });
for (const u of ['https://autocity.com.ar/catalogo/usados/', 'https://autocity.com.ar/catalogo/usados/page/2/']) {
  try { const r = await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 }); await p.waitForTimeout(6000);
    const html = await p.content(); out.paginas.push({ u, status: r?.status(), titulo: await p.title(), bytes: html.length, autos: (html.match(/\$\s?[\d\.]{7,}/g) || []).length, fichas: (html.match(/catalogo\/usados\/m-/g) || []).length, texto: (await p.innerText('body')).slice(0, 1500) });
    fs.writeFileSync('sondeo/autocity-' + (u.includes('page/2') ? 'p2' : 'usados') + '.html', html);
  } catch (e) { out.paginas.push({ u, error: e.message }); }
}
// DeRuedas: ¿hay catálogo de Autocity?
const dr = await (await fetch('https://www.deruedas.com.ar/busCraw.asp?weNeed=divAll&pag=1&mostrarRegistros=90&segmento=0&provincia=6')).text();
out.deruedas_cba = { bytes: dr.length, autocity: (dr.match(/autocity/gi) || []).length, logos: [...new Set([...dr.matchAll(/alt="([^"]*(?:Logo|logo)[^"]*)"/g)].map(m => m[1]))].slice(0, 30), codUsr: [...new Set([...dr.matchAll(/codUsr=(\d+)/g)].map(m => m[1]))].slice(0, 30) };
fs.writeFileSync('sondeo/autocity.json', JSON.stringify(out, null, 1));
await b.close();
