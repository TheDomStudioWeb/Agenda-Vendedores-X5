// Simulación mínima de Google Apps Script para probar el módulo de contratos (sin conexión a Google).
const vm = require('vm'), fs = require('fs');
function hoja(nombre) {
  const h = { nombre, filas: [], getLastRow() { return this.filas.length; }, getLastColumn() { return Math.max(1, ...this.filas.map(f => f.length)); },
    getDataRange() { const s = this; return { getValues: () => s.filas.map(f => f.slice()) }; },
    setFrozenRows() {}, deleteRow(n) { this.filas.splice(n - 1, 1); }, appendRow(f) { this.filas.push(f); },
    getRange(r, c, nr = 1, nc = 1) { const s = this; return {
      getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const f = s.filas[r - 1 + i] || []; const row = []; for (let j = 0; j < nc; j++) row.push(f[c - 1 + j] === undefined ? '' : f[c - 1 + j]); o.push(row); } return o; },
      setValues: v => { v.forEach((fila, i) => { while (s.filas.length < r + i) s.filas.push([]); const dst = s.filas[r - 1 + i]; fila.forEach((x, j) => { dst[c - 1 + j] = typeof x === 'string' && x[0] === "'" && !/^'[=+\-@]/.test(x) ? x.slice(1) : x; }); }); } }; } };
  return h;
}
function crear(personal) {
  const libro = {}, ss = { getSheetByName: n => libro[n] || null, insertSheet: n => (libro[n] = hoja(n)) };
  libro.Personal = hoja('Personal'); libro.Personal.filas = [['nombre', 'rol', 'estado', 'reporta_a', 'clave', 'telegram']].concat(personal);
  const cache = {}; let fecha = new Date('2026-10-26T15:00:00-03:00');
  const ctx = { console, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(fecha); } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    Session: { getScriptTimeZone: () => 'America/Argentina/Mendoza' },
    Utilities: { getUuid: () => require('crypto').randomUUID(), formatDate: (d, tz, f) => { const p = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d); return f === 'HH:mm' ? p.slice(11) : p.slice(0, 10); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) }, ContentService: {}, ScriptApp: {}, UrlFetchApp: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../Code.gs', 'utf8') + '\n;globalThis.__c={despacharContratos_,expandirNumeros_};', ctx);
  return { api: ctx.__c, libro, llamar: (u, body) => ctx.__c.despacharContratos_(body, u) };
}
module.exports = { crear };
