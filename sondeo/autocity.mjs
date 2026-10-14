import { chromium } from 'playwright';
import fs from 'node:fs';
const out = { apis: [] };
const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'es-AR', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36' });
const p = await ctx.newPage();
p.on('response', async r => { const ct = r.headers()['content-type'] || ''; if (/json/.test(ct) && /asofix|autocity/.test(r.url()) && !/contact-form/.test(r.url())) { let body = ''; try { body = (await r.text()).slice(0, 3000); } catch {} out.apis.push({ u: r.url(), status: r.status(), body }); } });
const t0 = Date.now();
const r = await p.goto('https://autocity.com.ar/catalogo/usados/m-volkswagen/m-up/1-0-highline-3p-l14/', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(3000);
out.ficha = { status: r.status(), ms: Date.now() - t0, titulo: await p.title(), texto: (await p.innerText('body')).slice(0, 2500) };
fs.writeFileSync('sondeo/autocity-ficha.html', await p.content());
// imagen grande sin "mini-"
const big = 'https://cdn.asofix.com/companies/13d2ec10-5ef5-11ea-8eed-536328ae2266/products/1791472323474.IMG_6492.jpeg';
const rb = await fetch(big); out.grande = { status: rb.status, tipo: rb.headers.get('content-type'), bytes: (await rb.arrayBuffer()).byteLength };
const rm = await fetch(big.replace('/products/', '/products/mini-')); out.mini = { status: rm.status, bytes: (await rm.arrayBuffer()).byteLength };
// ¿responde a fetch simple el catálogo con página?
const rs = await fetch('https://autocity.com.ar/catalogo/usados/page/3/', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0' } }); out.fetchSimple = rs.status;
fs.writeFileSync('sondeo/autocity.json', JSON.stringify(out, null, 1));
await b.close();
