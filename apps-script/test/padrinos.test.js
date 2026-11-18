// Pruebas de Padrinos X5 (node apps-script/test/padrinos.test.js)
const assert = require('assert'), { crear } = require('./mock');
const personal = [['Gerente Uno', 'Gerente Comercial', 'Activo', '', 'x', ''], ['Vendedor Carlos', 'Asesor', 'Activo', 'Gerente Uno', 'x', ''], ['Vendedora Dana', 'Asesor', 'Activo', 'Gerente Uno', 'x', ''], ['Sup Uno', 'Supervisor', 'Activo', '', 'x', ''], ['Ctrl Uno', 'Control', 'Activo', '', 'x', '']];
const GER = { nombre: 'Gerente Uno', rol: 'Gerente Comercial' }, V1 = { nombre: 'Vendedor Carlos', rol: 'Asesor' }, V2 = { nombre: 'Vendedora Dana', rol: 'Asesor' }, SUP = { nombre: 'Sup Uno', rol: 'Supervisor' }, CTL = { nombre: 'Ctrl Uno', rol: 'Control' };
let ok = 0, fail = 0;
const T = (n, f) => { try { f(); ok++; console.log('  ✓ ' + n); } catch (e) { fail++; console.log('  ✗ ' + n + '\n    ' + (e.stack || e).split('\n').slice(0, 4).join('\n    ')); } };
const m0 = () => { const m = crear(personal); m.reloj('2026-11-18T10:00:00-03:00'); return m; };
const alta = (m, u, d) => m.pad(u, { action: 'padrinos_guardar', data: d });

T('arranca vacío y el asesor da de alta a su cliente como padrino con un código', () => {
  const m = m0(); const d0 = m.pad(V1, { action: 'padrinos_datos' }); assert(d0.ok); assert.strictEqual(d0.padrinos.length, 0);
  const r = alta(m, V1, { nombre: 'Lucía Gómez', telefono: '261 555-1234', cumple: '1990-11-27' }); assert(r.ok, JSON.stringify(r));
  assert(/^X5-[A-Z2-9]{5}$/.test(r.padrino.codigo)); assert.strictEqual(r.padrino.asesor, 'Vendedor Carlos'); assert.strictEqual(r.padrino.telefono, '2615551234');
  assert.strictEqual(alta(m, V1, { nombre: 'Otra', telefono: '2615551234' }).error, 'padrino_existe');
  assert.strictEqual(alta(m, V1, { nombre: 'Para otro', telefono: '2615550000', asesor: 'Vendedora Dana' }).error, 'sin_permiso');
  assert.strictEqual(m.pad(V2, { action: 'padrinos_datos' }).padrinos.length, 0); // otro asesor no lo ve
  assert.strictEqual(m.pad(GER, { action: 'padrinos_datos' }).padrinos.length, 1);
});
T('el referido entra como lead «Referido» en el CRM y avisa al asesor si lo carga otro', () => {
  const m = m0(); const p = alta(m, GER, { nombre: 'Lucía Gómez', telefono: '2615551234', asesor: 'Vendedor Carlos' }).padrino;
  const r = m.pad(GER, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'Martín Ruiz', telefono: '2614440000', sistema: '10 adelantos' } }); assert(r.ok, JSON.stringify(r));
  assert.strictEqual(r.referido.asesor, 'Vendedor Carlos'); assert.strictEqual(r.referido.estado, 'camino');
  const L = m.libro.Leads.filas, h = L[0]; const lead = L[1]; const v = k => lead[h.indexOf(k)];
  assert.strictEqual(v('origen'), 'Referido'); assert.strictEqual(v('asignado_a'), 'Vendedor Carlos'); assert(/padrino X5-/.test(v('notas'))); assert.strictEqual(String(v('id')), r.lead_id);
  assert.strictEqual(m.pad(GER, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'Martín otra vez', telefono: '2614440000' } }).error, 'referido_existe');
  assert.strictEqual(m.pad(GER, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'Ella misma', telefono: '2615551234' } }).error, 'autorreferido');
});
T('un teléfono que ya era lead no suma como referido', () => {
  const m = m0(); const p = alta(m, V1, { nombre: 'Lucía', telefono: '2615551234' }).padrino;
  m.libro.Leads.filas = [['id', 'cliente', 'telefono', 'asignado_a'], ['1', 'Ya cargado', "2617778888", 'Vendedora Dana']];
  assert.strictEqual(m.pad(V1, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'X', telefono: '0261 15 777-8888' } }).error, 'lead_existe');
});
T('el asesor avanza de a un paso; cuota 3, retiro y baja solo los confirma supervisión', () => {
  const m = m0(); const p = alta(m, V1, { nombre: 'Lucía', telefono: '2615551234' }).padrino;
  const id = m.pad(V1, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'Martín', telefono: '2614440000' } }).referido.id;
  assert.strictEqual(m.pad(V1, { action: 'referidos_estado', id, estado: 'firmo' }).error, 'orden_invalido');
  assert(m.pad(V1, { action: 'referidos_estado', id, estado: 'entrevista' }).ok);
  assert.strictEqual(m.pad(V1, { action: 'referidos_estado', id, estado: 'firmo' }).error, 'falta_sistema');
  const f = m.pad(V1, { action: 'referidos_estado', id, estado: 'firmo', sistema: '5 adelantos', nro_contrato: '12345' }); assert(f.ok); assert.strictEqual(f.referido.fecha_firma, '2026-11-18');
  assert.strictEqual(m.pad(V1, { action: 'referidos_estado', id, estado: 'cuota3' }).error, 'solo_supervision');
  assert.strictEqual(m.pad(V2, { action: 'referidos_estado', id, estado: 'firmo' }).error, 'sin_permiso');
  assert(m.pad(GER, { action: 'referidos_estado', id, estado: 'cuota3' }).ok);
  assert.strictEqual(m.pad(GER, { action: 'referidos_estado', id, estado: 'baja' }).error, 'baja_tarde');
  const d = m.pad(V1, { action: 'padrinos_datos' }); assert.strictEqual(d.referidos[0].estado, 'cuota3'); assert.strictEqual(d.referidos[0].nro_contrato, '12345');
  assert(m.libro.PadrinosLog.filas.length >= 5);
});
T('lo que suma puntos del plan propio (cuotas, retiro, reseña) lo carga supervisión', () => {
  const m = m0(); const p = alta(m, V1, { nombre: 'Lucía', telefono: '2615551234' }).padrino;
  let r = alta(m, V1, { id: p.id, nombre: 'Lucía', telefono: '2615551234', retiro: 'si', cuotas_al_dia: 12 }); assert(r.ok); assert.strictEqual(r.padrino.retiro, ''); assert.strictEqual(Number(r.padrino.cuotas_al_dia), 0);
  r = alta(m, GER, { id: p.id, nombre: 'Lucía', telefono: '2615551234', asesor: 'Vendedor Carlos', retiro: 'si', cuotas_al_dia: 12, resena: 'si' }); assert(r.ok); assert.strictEqual(r.padrino.retiro, 'si'); assert.strictEqual(r.padrino.fecha_retiro, '2026-11-18'); assert.strictEqual(r.padrino.cuotas_al_dia, 12);
  assert.strictEqual(m.pad(V1, { action: 'padrinos_datos' }).padrinos[0].codigo, p.codigo); // el código no cambia al editar
});
T('supervisor solo mira; control no entra', () => {
  const m = m0(); alta(m, V1, { nombre: 'Lucía', telefono: '2615551234' });
  assert.strictEqual(m.pad(SUP, { action: 'padrinos_datos' }).padrinos.length, 1);
  assert.strictEqual(alta(m, SUP, { nombre: 'X', telefono: '2610000000' }).error, 'sin_permiso');
  assert.strictEqual(m.pad(CTL, { action: 'padrinos_datos' }).error, 'sin_permiso');
});
T('la tarjeta pública solo abre con código + llave y no muestra teléfonos', () => {
  const m = m0(); const p = alta(m, V1, { nombre: 'Lucía Gómez', telefono: '2615551234' }).padrino;
  assert(p.llave && p.llave.length >= 32);
  m.pad(V1, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'Martín Ruiz', telefono: '2614440000' } });
  const r = m.api.paseCliente_(p.codigo.toLowerCase(), p.llave); assert(r.ok, JSON.stringify(r));
  assert.strictEqual(r.padrino.nombre, 'Lucía Gómez'); assert.strictEqual(r.referidos[0].cliente, 'Martín');
  const txt = JSON.stringify(r); assert(!/2615551234|2614440000|llave|Ruiz/.test(txt), txt);
  assert.strictEqual(m.api.paseCliente_(p.codigo, p.llave.slice(0, -1) + 'x').error, 'pase_invalido');
  assert.strictEqual(m.api.paseCliente_(p.codigo, '').error, 'pase_invalido');
  alta(m, GER, { id: p.id, nombre: 'Lucía Gómez', telefono: '2615551234', asesor: 'Vendedor Carlos', estado: 'baja' });
  assert.strictEqual(m.api.paseCliente_(p.codigo, p.llave).error, 'pase_baja');
});
T('un padrino sin llave (cargado antes) la recibe al abrir el Hub y no cambia después', () => {
  const m = m0(); const p = alta(m, V1, { nombre: 'Lucía', telefono: '2615551234' }).padrino;
  const sh = m.libro.Padrinos, h = sh.filas[0]; sh.filas[1][h.indexOf('llave')] = '';
  const k1 = m.pad(V1, { action: 'padrinos_datos' }).padrinos[0].llave; assert(k1 && k1.length >= 32);
  assert.strictEqual(m.pad(V1, { action: 'padrinos_datos' }).padrinos[0].llave, k1);
  assert(m.api.paseCliente_(p.codigo, k1).ok);
});
T('el padrino carga un referido desde su tarjeta: entra como lead «Referido» con plazo de 2 h y aviso al asesor', () => {
  const m = m0(); const p = alta(m, GER, { nombre: 'Lucía Gómez', telefono: '2615551234', asesor: 'Vendedor Carlos' }).padrino;
  const post = b => m.post(Object.assign({ c: p.codigo, k: p.llave, acepta: true }, b));
  assert.strictEqual(post({ action: 'pase_referido', cliente: 'Martín', telefono: '2614440000', acepta: false }).error, 'falta_consentimiento');
  assert.strictEqual(m.post({ action: 'pase_referido', c: p.codigo, k: 'x'.repeat(40), acepta: true, cliente: 'M', telefono: '2614440000' }).error, 'pase_invalido');
  const antes = m.enviados.length;
  const r = post({ action: 'pase_referido', cliente: 'Martín Ruiz', telefono: '261 444-0000', interes: 'Moto' }); assert(r.ok, JSON.stringify(r)); assert(!r.referido); // no devuelve datos
  const L = m.libro.Leads.filas, h = L[0], lead = L[L.length - 1], v = k => lead[h.indexOf(k)];
  assert.strictEqual(v('origen'), 'Referido'); assert.strictEqual(v('asignado_a'), 'Vendedor Carlos'); assert.strictEqual(v('hora_limite'), '12:00'); assert.strictEqual(v('fecha_asignacion'), '2026-11-18'); assert(/desde su tarjeta/.test(v('notas')));
  const d = m.pad(V1, { action: 'padrinos_datos' }); assert.strictEqual(d.referidos[0].cargado_por, 'padrino'); assert.strictEqual(d.referidos[0].estado, 'camino');
  const dup = post({ action: 'pase_referido', cliente: 'Otro', telefono: '2614440000' }); assert.strictEqual(dup.error, 'referido_existe'); assert(!dup.detalle); // no revela datos de otros
  assert.strictEqual(post({ action: 'pase_referido', cliente: 'Yo', telefono: '2615551234' }).error, 'autorreferido');
  assert.strictEqual(post({ action: 'pase_referido', cliente: 'Corto', telefono: '12345' }).error, 'falta_telefono');
  for (let i = 0; i < 4; i++) assert(post({ action: 'pase_referido', cliente: 'R' + i, telefono: '261400000' + i }).ok);
  assert.strictEqual(post({ action: 'pase_referido', cliente: 'Sexto', telefono: '2614000009' }).error, 'demasiados');
});
T('fuera de horario, el plazo del referido pasa a las 11 del día hábil siguiente', () => {
  const m = crear(personal); m.reloj('2026-11-20T21:30:00-03:00'); // viernes a la noche
  const p = alta(m, GER, { nombre: 'Lucía', telefono: '2615551234', asesor: 'Vendedor Carlos' }).padrino;
  assert(m.post({ action: 'pase_referido', c: p.codigo, k: p.llave, acepta: true, cliente: 'Martín', telefono: '2614440000' }).ok);
  const L = m.libro.Leads.filas, h = L[0], lead = L[L.length - 1];
  assert.strictEqual(lead[h.indexOf('fecha_asignacion')], '2026-11-23'); assert.strictEqual(lead[h.indexOf('hora_limite')], '11:00');
});
console.log(`\n${ok} bien, ${fail} con error`); process.exit(fail ? 1 : 0);
