// Pruebas del registro de ingreso y egreso (node apps-script/test/asistencia.test.js)
const assert = require('assert'), { crear } = require('./mock');
const personal = [['Gerente Uno', 'Gerente Comercial', 'Activo', '', 'x', ''], ['Marta Limpieza', 'Personal', 'Activo', 'Gerente Uno', 'x', ''], ['Vendedor Carlos', 'Asesor', 'Activo', 'Gerente Uno', 'x', ''], ['Sup Uno', 'Supervisor', 'Activo', '', 'x', '']];
const GER = { nombre: 'Gerente Uno', rol: 'Gerente Comercial' }, LIM = { nombre: 'Marta Limpieza', rol: 'Personal' }, V1 = { nombre: 'Vendedor Carlos', rol: 'Asesor' }, SUP = { nombre: 'Sup Uno', rol: 'Supervisor' };
let ok = 0, fail = 0;
const T = (n, f) => { try { f(); ok++; console.log('  ✓ ' + n); } catch (e) { fail++; console.log('  ✗ ' + n + '\n    ' + (e.stack || e).split('\n').slice(0, 4).join('\n    ')); } };
const m0 = () => { const m = crear(personal); m.reloj('2026-11-16T08:02:00-03:00'); return m; };

T('minutos y lunes', () => { const m = m0(); assert.strictEqual(m.api.minutosEntre_('08:00', '12:30'), 270); assert.strictEqual(m.api.minutosEntre_('22:00', '02:00'), 240); assert.strictEqual(m.api.lunesDe_('2026-11-22'), '2026-11-16'); assert.strictEqual(m.api.lunesDe_('2026-11-16'), '2026-11-16'); });
T('marca ingreso y salida con la hora del servidor y calcula los minutos', () => {
  const m = m0();
  let r = m.asis(LIM, { action: 'asistencia_marcar', tipo: 'entrada' }); assert(r.ok, JSON.stringify(r)); assert.strictEqual(r.registro.entrada, '08:02'); assert.strictEqual(r.registro.fecha, '2026-11-16');
  assert.strictEqual(m.asis(LIM, { action: 'asistencia_marcar', tipo: 'entrada' }).error, 'ya_adentro');
  let d = m.asis(LIM, { action: 'asistencia_datos' }); assert(d.abierto && d.abierto.entrada === '08:02'); assert.strictEqual(d.desde, '2026-11-16'); assert.strictEqual(d.hasta, '2026-11-22');
  m.reloj('2026-11-16T12:47:00-03:00'); r = m.asis(LIM, { action: 'asistencia_marcar', tipo: 'salida' }); assert(r.ok); assert.strictEqual(r.registro.salida, '12:47'); assert.strictEqual(r.registro.minutos, 285);
  assert.strictEqual(m.asis(LIM, { action: 'asistencia_marcar', tipo: 'salida' }).error, 'sin_entrada');
  d = m.asis(LIM, { action: 'asistencia_datos' }); assert.strictEqual(d.abierto, null); assert.strictEqual(d.semana.length, 1); assert.strictEqual(d.semana[0].minutos, 285);
});
T('dos turnos el mismo día y semana completa', () => {
  const m = m0();
  const turno = (dia, e, s) => { m.reloj(`2026-11-${dia}T${e}:00-03:00`); m.asis(LIM, { action: 'asistencia_marcar', tipo: 'entrada' }); m.reloj(`2026-11-${dia}T${s}:00-03:00`); m.asis(LIM, { action: 'asistencia_marcar', tipo: 'salida' }); };
  turno('16', '08:00', '12:00'); turno('16', '15:00', '17:30'); turno('17', '08:00', '12:00'); turno('21', '09:00', '13:00'); turno('23', '08:00', '12:00');
  const d = m.asis(LIM, { action: 'asistencia_datos', desde: '2026-11-18' }); assert.strictEqual(d.desde, '2026-11-16'); assert.strictEqual(d.semana.length, 4);
  assert.strictEqual(d.semana.reduce((t, r) => t + r.minutos, 0), 4 * 60 + 150 + 240 + 240);
  const d2 = m.asis(LIM, { action: 'asistencia_datos', desde: '2026-11-23' }); assert.strictEqual(d2.semana.length, 1);
});
T('el personal no ve a otros; gerencia y supervisor sí, y ven quién está adentro', () => {
  const m = m0(); m.asis(LIM, { action: 'asistencia_marcar', tipo: 'entrada' });
  const d = m.asis(LIM, { action: 'asistencia_datos', nombre: 'Vendedor Carlos' }); assert.strictEqual(d.nombre, 'Marta Limpieza'); assert(!d.personas);
  const g = m.asis(GER, { action: 'asistencia_datos', nombre: 'Marta Limpieza' }); assert.strictEqual(g.semana.length, 1); assert(g.personas.includes('Marta Limpieza')); assert.strictEqual(g.adentro[0].nombre, 'Marta Limpieza');
  const s = m.asis(SUP, { action: 'asistencia_datos', nombre: 'Marta Limpieza' }); assert.strictEqual(s.semana.length, 1);
  assert.strictEqual(m.asis(SUP, { action: 'asistencia_marcar', tipo: 'entrada' }).error, 'sin_permiso');
});
T('solo gerencia corrige, con motivo; un olvido de salida se cierra a mano', () => {
  const m = m0(); m.asis(LIM, { action: 'asistencia_marcar', tipo: 'entrada' });
  let d = m.asis(GER, { action: 'asistencia_datos', nombre: 'Marta Limpieza' }); const id = d.semana[0].id;
  assert.strictEqual(m.asis(LIM, { action: 'asistencia_corregir', id, entrada: '08:00', salida: '12:00', motivo: 'x' }).error, 'sin_permiso');
  assert.strictEqual(m.asis(GER, { action: 'asistencia_corregir', id, entrada: '08:00', salida: '12:00' }).error, 'falta_motivo');
  assert(m.asis(GER, { action: 'asistencia_corregir', id, entrada: '08:00', salida: '12:00', motivo: 'Se olvidó de marcar la salida' }).ok);
  d = m.asis(LIM, { action: 'asistencia_datos' }); assert.strictEqual(d.abierto, null); assert.strictEqual(d.semana[0].minutos, 240); assert(/Corregido por Gerente Uno/.test(d.semana[0].nota));
  assert(m.asis(GER, { action: 'asistencia_corregir', nombre: 'Marta Limpieza', fecha: '2026-11-17', entrada: '08:00', salida: '11:00', motivo: 'Día sin conexión' }).ok);
  d = m.asis(LIM, { action: 'asistencia_datos' }); assert.strictEqual(d.semana.length, 2);
  assert(m.asis(GER, { action: 'asistencia_corregir', id, borrar: true, motivo: 'Duplicado' }).ok);
  assert.strictEqual(m.asis(LIM, { action: 'asistencia_datos' }).semana.length, 1); assert(m.libro.Eliminados.filas.length >= 2);
});
T('salida muy tardía queda señalada para revisar', () => {
  const m = m0(); m.asis(LIM, { action: 'asistencia_marcar', tipo: 'entrada' }); m.reloj('2026-11-17T09:00:00-03:00');
  const r = m.asis(LIM, { action: 'asistencia_marcar', tipo: 'salida' }); assert(r.revisar); assert(/Revisar/.test(r.registro.nota));
});
T('por la entrada principal: el rol Personal solo puede usar asistencia y no aparece en el CRM', () => {
  const m = m0();
  const tok = m.post({ action: 'login', nombre: 'Marta Limpieza', clave: 'x' }).token; assert(tok);
  assert.strictEqual(m.post({ action: 'datos', token: tok }).error, 'sin_permiso');
  assert.strictEqual(m.post({ action: 'contratos_datos', token: tok }).error, 'sin_permiso');
  assert(m.post({ action: 'asistencia_marcar', tipo: 'entrada', token: tok }).ok);
  const tg = m.post({ action: 'login', nombre: 'Gerente Uno', clave: 'x' }).token;
  const d = m.post({ action: 'datos', token: tg }); assert(d.ok); assert(!d.personal.some(p => p.nombre === 'Marta Limpieza'));
  assert(m.post({ action: 'asistencia_datos', token: tg, nombre: 'Marta Limpieza' }).semana.length === 1);
});
console.log(`\n${ok} bien, ${fail} con error`); process.exit(fail ? 1 : 0);
