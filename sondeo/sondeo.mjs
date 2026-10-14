import { writeFile, mkdir } from 'node:fs/promises';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept-Language': 'es-AR,es;q=0.9' };
const urls = {
  'bc-gol-mza.html': 'https://www.deruedas.com.ar/busCraw.asp?segmento=0&marca=Volkswagen&modelo=Volkswagen%3AGol+Trend&provincia=1&weNeed=divBusqueda&pag=1',
  'bc-gol-pais-90.html': 'https://www.deruedas.com.ar/busCraw.asp?segmento=0&marca=Volkswagen&modelo=Volkswagen%3AGol+Trend&weNeed=divBusqueda&pag=1&mostrarRegistros=90',
  'bc-gol-pais-p2.html': 'https://www.deruedas.com.ar/busCraw.asp?segmento=0&marca=Volkswagen&modelo=Volkswagen%3AGol+Trend&weNeed=divBusqueda&pag=2',
  'bc-gol-cba.html': 'https://www.deruedas.com.ar/busCraw.asp?segmento=0&marca=Volkswagen&modelo=Volkswagen%3AGol+Trend&provincia=6&weNeed=divBusqueda&pag=1',
  'bc-toyota.html': 'https://www.deruedas.com.ar/busCraw.asp?segmento=0&marca=Toyota&weNeed=divAll&pag=1',
  'bc-prov.html': 'https://www.deruedas.com.ar/busCraw.asp?segmento=0&weNeed=divAll&pag=1',
};
await mkdir('sondeo/html', { recursive: true });
const log = [];
for (const [f, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(45000) }); const t = await r.text(); await writeFile('sondeo/html/' + f, t); log.push(`${f}\t${r.status}\t${r.url}\t${t.length}`); }
  catch (e) { log.push(`${f}\tERROR ${e.message}`); }
  await new Promise(r => setTimeout(r, 800));
}
await writeFile('sondeo/html/log.txt', log.join('\n'));
