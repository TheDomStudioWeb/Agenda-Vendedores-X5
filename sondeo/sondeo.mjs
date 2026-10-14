import { writeFile, mkdir } from 'node:fs/promises';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept-Language': 'es-AR,es;q=0.9' };
const urls = {
  'dr-gol-pais.html': 'https://www.deruedas.com.ar/bus.asp?segmento=0&marca=Volkswagen&modelo=Gol%20Trend&provincia=0&anio_1=2014&anio_2=2016&mostrarRegistros=90',
  'dr-gol-mza.html': 'https://www.deruedas.com.ar/bus.asp?segmento=0&marca=Volkswagen&modelo=Gol%20Trend&provincia=1',
  'dr-hilux-cba.html': 'https://www.deruedas.com.ar/bus.asp?segmento=0&marca=Toyota&modelo=Hilux&provincia=6&mostrarRegistros=90',
  'dr-ajax-p2.html': 'https://www.deruedas.com.ar/bus.asp?segmento=0&marca=Volkswagen&modelo=Gol%20Trend&provincia=0&weNeed=divBusqueda&pag=2',
};
await mkdir('sondeo/html', { recursive: true });
const log = [];
for (const [f, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(45000) }); const t = await r.text(); await writeFile('sondeo/html/' + f, t); log.push(`${f}\t${r.status}\t${r.url}\t${t.length}`); }
  catch (e) { log.push(`${f}\tERROR ${e.message}`); }
  await new Promise(r => setTimeout(r, 800));
}
await writeFile('sondeo/html/log.txt', log.join('\n'));
