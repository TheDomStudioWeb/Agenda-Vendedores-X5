// Prueba en vivo del Buscador.gs fuera de Apps Script (descargas con curl, igual que UrlFetchApp.fetchAll).
import fs from 'node:fs'; import vm from 'node:vm'; import { execFileSync } from 'node:child_process';
const ctx = { console, ContentService: {}, CacheService: {}, UrlFetchApp: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('sondeo/Buscador.gs', 'utf8'), ctx);
const bajar = (urls) => urls.map(u => { try { const t = execFileSync('curl', ['-sL', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0', '--max-time', '40', u], { maxBuffer: 50e6 }).toString(); return { codigo: 200, texto: t }; } catch (e) { return { codigo: 0, texto: '' }; } });
const consultas = [
  { marca: 'Volkswagen', modelo: 'Gol Trend', provincia: 'mendoza', desde: 2014, hasta: 2016 },
  { marca: 'Toyota', modelo: 'Hilux', provincia: 'cordoba', desde: 2018, hasta: 2022 },
  { marca: 'Volkswagen', modelo: 'Amarok', provincia: '', desde: 0, hasta: 0 },
];
const out = consultas.map(q => { const t0 = Date.now(); const r = ctx.buscar_(q, bajar); return { q, ms: Date.now() - t0, fuentes: r.fuentes, total: r.autos.length, muestra: r.autos.slice(0, 4) }; });
fs.writeFileSync('sondeo/buscador-prueba.json', JSON.stringify(out, null, 1));
