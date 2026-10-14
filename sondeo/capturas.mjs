// Capturas del Radar para el manual (celular, modo oscuro), con fotos y búsquedas reales.
import { chromium } from 'playwright';
const B = 'http://localhost:8080/radar/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'es-AR', isMobile: true, hasTouch: true });
const nueva = async (vista) => { const p = await ctx.newPage(); await p.addInitScript(v => { try { localStorage.clear(); localStorage.setItem('radar.vista', v); } catch (e) {} }, vista); await p.goto(B, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500); return p; };
const shot = (p, n) => p.screenshot({ path: `sondeo/capturas/${n}.png` });
const esperarFotos = async (p) => { await p.waitForTimeout(3500); };

let p = await nueva('cliente'); await esperarFotos(p); await shot(p, '01-cliente');
await p.fill('#q', 'Amarok'); await p.waitForTimeout(2500); await shot(p, '02-cliente-busqueda'); await p.fill('#q', '');
await p.waitForTimeout(800); await p.click('.auto >> nth=0'); await p.waitForTimeout(3500); await shot(p, '03-ficha-arriba');
await p.evaluate(() => { const d = document.querySelector('dialog'); d.scrollTop = d.scrollHeight; }); await p.waitForTimeout(800); await shot(p, '04-ficha-abajo');
await p.close();

p = await nueva('interno'); await esperarFotos(p); await shot(p, '05-interno');
await p.click('#cfg-box summary'); await p.waitForTimeout(600); await shot(p, '06-precio-x5');
await p.click('#cfg-box summary'); await p.waitForTimeout(400);
await p.click('.fila >> nth=0'); await p.waitForTimeout(2500); await p.evaluate(() => { const d = document.querySelector('dialog'); d.scrollTop = d.scrollHeight; }); await p.waitForTimeout(600); await shot(p, '07-ficha-interna');
await p.close();

p = await nueva('compra'); await p.waitForTimeout(2500);
await p.selectOption('#c-marca', 'VOLKSWAGEN'); await p.fill('#c-modelo', 'Gol Trend'); await p.fill('#c-desde', '2014'); await p.fill('#c-hasta', '2016'); await p.selectOption('#c-prov', 'Mendoza');
await shot(p, '08-compra-formulario');
await p.click('#c-buscar'); await p.waitForSelector('#c-res .resumen', { timeout: 90000 }); await esperarFotos(p);
await p.evaluate(() => document.querySelector('#c-res').scrollIntoView()); await p.evaluate(() => window.scrollBy(0, -20)); await p.waitForTimeout(1500); await shot(p, '09-compra-resultados');
await p.evaluate(() => window.scrollBy(0, 640)); await p.waitForTimeout(1500); await shot(p, '10-compra-lista');
await p.close();

p = await nueva('novedades'); await p.waitForTimeout(2000); await shot(p, '11-novedades'); await p.close();

const d = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'es-AR' });
const pd = await d.newPage(); await pd.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('radar.vista', 'cliente'); } catch (e) {} });
await pd.goto(B, { waitUntil: 'networkidle' }); await pd.waitForTimeout(5000); await pd.screenshot({ path: 'sondeo/capturas/00-escritorio.png' });
await b.close();
