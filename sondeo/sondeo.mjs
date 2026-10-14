import { writeFile, mkdir } from 'node:fs/promises';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept-Language': 'es-AR,es;q=0.9' };
const urls = {
  'deruedas-busqueda.html': 'https://www.deruedas.com.ar/bus.asp?pal=gol+trend+2015',
  'deruedas-home.html': 'https://www.deruedas.com.ar/',
  'deruedas-mendoza.html': 'https://www.deruedas.com.ar/bus.asp?pal=gol+trend&prov=mendoza',
  'autocosmos-gol.html': 'https://www.autocosmos.com.ar/auto/usado/volkswagen/gol-trend?anio=2015',
  'autocosmos-mendoza.html': 'https://www.autocosmos.com.ar/auto/usado/mendoza/volkswagen/gol-trend',
};
await mkdir('sondeo/html', { recursive: true });
const log = [];
for (const [f, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(45000) }); const t = await r.text(); await writeFile('sondeo/html/' + f, t); log.push(`${f}\t${r.status}\t${r.url}\t${t.length}`); }
  catch (e) { log.push(`${f}\tERROR ${e.message}`); }
}
await writeFile('sondeo/html/log.txt', log.join('\n'));
