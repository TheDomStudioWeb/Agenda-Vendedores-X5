import { writeFile } from 'node:fs/promises';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept-Language': 'es-AR,es;q=0.9' };
const urls = {
  ml_api: 'https://api.mercadolibre.com/sites/MLA/search?category=MLA1744&q=gol%20trend%202015&limit=5',
  ml_web: 'https://autos.mercadolibre.com.ar/volkswagen/gol-trend/2015/',
  deruedas: 'https://www.deruedas.com.ar/bus.asp?pal=gol+trend+2015',
  autocosmos: 'https://www.autocosmos.com.ar/auto/usado/volkswagen/gol-trend?anio=2015',
  autocity: 'https://www.autocity.com.ar/usados',
  autocity_wp: 'https://www.autocity.com.ar/wp-json/',
};
const out = {};
for (const [k, u] of Object.entries(urls)) {
  try {
    const r = await fetch(u, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(45000) });
    const t = await r.text();
    out[k] = { status: r.status, url: r.url, bytes: t.length, gol: (t.match(/gol trend/gi) || []).length, precios: (t.match(/\$\s?[\d\.]{6,}/g) || []).slice(0, 5), muestra: t.slice(0, 600) };
  } catch (e) { out[k] = { error: e.message }; }
}
await writeFile('sondeo/resultado.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
