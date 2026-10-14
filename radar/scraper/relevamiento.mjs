// Relevamiento: baja páginas de muestra de Maipú Usados para estudiar su estructura.
import { writeFile, mkdir } from 'node:fs/promises';
const OUT = 'radar/debug';
await mkdir(OUT, { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (X5 Radar; +https://thedomstudioweb.github.io/Agenda-Vendedores-X5/)' };
const urls = {
  'catalogo.html': 'https://maipuusados.com.ar/modelos/',
  'catalogo-p2.html': 'https://maipuusados.com.ar/modelos/?_paged=2',
  'ficha.html': 'https://maipuusados.com.ar/2026/10/09/onix-3/',
  'wp-json-root.json': 'https://maipuusados.com.ar/wp-json/',
  'wp-posts.json': 'https://maipuusados.com.ar/wp-json/wp/v2/posts?per_page=3',
  'wp-types.json': 'https://maipuusados.com.ar/wp-json/wp/v2/types',
};
const log = [];
for (const [f, u] of Object.entries(urls)) {
  const t0 = Date.now();
  try {
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) });
    const txt = await r.text();
    await writeFile(`${OUT}/${f}`, txt.slice(0, 3_000_000));
    log.push(`${f}\t${r.status}\t${txt.length} bytes\t${Date.now() - t0} ms\t${r.headers.get('x-wp-total') || ''}`);
  } catch (e) { log.push(`${f}\tERROR\t${e.message}`); }
}
await writeFile(`${OUT}/log.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
