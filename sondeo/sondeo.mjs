import { writeFile, mkdir } from 'node:fs/promises';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept-Language': 'es-AR,es;q=0.9' };
const urls = {
  'dr-vendo-mza.html': 'https://www.deruedas.com.ar/vendo/Volkswagen/Gol-Trend/Usado/Mendoza',
  'dr-vendo-pais.html': 'https://www.deruedas.com.ar/vendo/Volkswagen/Gol-Trend/Usado',
  'dr-vendo-mza-p2.html': 'https://www.deruedas.com.ar/vendo/Volkswagen/Gol-Trend/Usado/Mendoza?pag=2',
  'dr-vendo-sanjuan.html': 'https://www.deruedas.com.ar/vendo/Volkswagen/Gol-Trend/Usado/San-Juan',
  'dr-vendo-hilux.html': 'https://www.deruedas.com.ar/vendo/Toyota/Hilux/Usado/Cordoba',
  'ac-sanjuan.html': 'https://www.autocosmos.com.ar/auto/usado/volkswagen/gol-trend?pr=317',
  'ac-mza-2015.html': 'https://www.autocosmos.com.ar/auto/usado/volkswagen/gol-trend?pr=312&a=2015',
  'ac-pais-p2.html': 'https://www.autocosmos.com.ar/auto/usado/volkswagen/gol-trend?pidx=2',
  'ac-hilux.html': 'https://www.autocosmos.com.ar/auto/usado/toyota/hilux?pr=305',
};
await mkdir('sondeo/html', { recursive: true });
const log = [];
for (const [f, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(45000) }); const t = await r.text(); await writeFile('sondeo/html/' + f, t); log.push(`${f}\t${r.status}\t${r.url}\t${t.length}`); }
  catch (e) { log.push(`${f}\tERROR ${e.message}`); }
  await new Promise(r => setTimeout(r, 800));
}
await writeFile('sondeo/html/log.txt', log.join('\n'));
