const assert = require('assert'), { crear } = require('./mock');
const GER = { nombre: 'Gerente Uno', rol: 'Gerente Comercial' }, JEF = { nombre: 'Jefe Ana', rol: 'Jefe de Ventas' }, JEF2 = { nombre: 'Jefe Beto', rol: 'Jefe de Ventas' };
const V1 = { nombre: 'Vendedor Carlos', rol: 'Asesor' }, V2 = { nombre: 'Vendedora Dana', rol: 'Asesor' }, V3 = { nombre: 'Vendedor Eli', rol: 'Asesor' };
const personal = [['Gerente Uno', 'Gerente Comercial', 'Activo', '', 'x', ''], ['Jefe Ana', 'Jefe de Ventas', 'Activo', 'Gerente Uno', 'x', ''], ['Jefe Beto', 'Jefe de Ventas', 'Activo', 'Gerente Uno', 'x', ''],
  ['Vendedor Carlos', 'Asesor', 'Activo', 'Jefe Ana', 'x', ''], ['Vendedora Dana', 'Asesor', 'Activo', 'Jefe Ana', 'x', ''], ['Vendedor Eli', 'Asesor', 'Activo', 'Jefe Beto', 'x', ''], ['Ex Persona', 'Asesor', 'Baja', 'Jefe Ana', 'x', '']];
let ok = 0, fail = 0;
const T = (n, f) => { try { f(); ok++; console.log('  ✓ ' + n); } catch (e) { fail++; console.log('  ✗ ' + n + '\n    ' + (e.stack || e).split('\n').slice(0, 3).join('\n    ')); } };
const nuevo = () => crear(personal);
const datos = (m, u) => m.llamar(u, { action: 'contratos_datos' });
const idDe = (m, num) => datos(m, GER).contratos.find(c => c.numero === num).id;

T('rangos y listas de números', () => { const m = nuevo(); const r = m.api.expandirNumeros_('1001-1003, 1010 1011;1002 abc-9 ##'); assert.deepStrictEqual(Array.from(r.numeros), ['1001', '1002', '1003', '1010', '1011', 'abc-9']); assert.strictEqual(r.problemas.length, 1); });
T('rango con ceros a la izquierda y tope', () => { const m = nuevo(); assert.deepStrictEqual(Array.from(m.api.expandirNumeros_('0098-0101').numeros), ['0098', '0099', '0100', '0101']); assert(m.api.expandirNumeros_('1-99999').problemas.length === 1); });
T('solo gerencia carga números; los repetidos no se duplican', () => {
  const m = nuevo(); assert.strictEqual(m.llamar(JEF, { action: 'contratos_cargar', numeros: '1-5' }).error, 'sin_permiso');
  let r = m.llamar(GER, { action: 'contratos_cargar', numeros: '1001-1010' }); assert(r.ok && r.cargados === 10);
  r = m.llamar(GER, { action: 'contratos_cargar', numeros: '1008-1012' }); assert(r.ok && r.cargados === 2 && r.repetidos.length === 3);
  const d = datos(m, GER); assert.strictEqual(d.contratos.length, 12); assert(d.contratos.every(c => c.estado === 'Disponible' && c.responsable === ''));
});
T('gerente asigna a un jefe: pasa a Vacío, queda fecha y quién asignó; el jefe lo ve y el otro jefe no', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '1001-1010' });
  const ids = ['1001', '1002', '1003'].map(n => idDe(m, n)); const r = m.llamar(GER, { action: 'contratos_asignar', ids, responsable: 'Jefe Ana' }); assert(r.ok && r.cambiados === 3);
  const a = datos(m, JEF).contratos; assert.strictEqual(a.length, 3); assert(a.every(c => c.estado === 'Vacío' && c.responsable === 'Jefe Ana' && c.asignado_por === 'Gerente Uno' && c.fecha_asignacion === '2026-10-26'));
  assert.strictEqual(datos(m, JEF2).contratos.length, 0); assert.strictEqual(datos(m, V1).contratos.length, 0);
});
T('el jefe reparte a su equipo, no a otro equipo ni a una baja', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '1-4' }); const ids = ['1', '2', '3', '4'].map(n => idDe(m, n)); m.llamar(GER, { action: 'contratos_asignar', ids, responsable: 'Jefe Ana' });
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_asignar', ids: [ids[0]], responsable: 'Vendedor Carlos' }).cambiados, 1);
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_asignar', ids: [ids[1]], responsable: 'Vendedor Eli' }).error, 'destino_fuera_de_alcance');
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_asignar', ids: [ids[1]], responsable: 'Ex Persona' }).error, 'destino_fuera_de_alcance');
  assert.strictEqual(m.llamar(V1, { action: 'contratos_asignar', ids: [ids[2]], responsable: 'Vendedor Carlos' }).error, 'sin_permiso');
  assert.strictEqual(datos(m, V1).contratos.length, 1); assert.strictEqual(datos(m, V2).contratos.length, 0);
});
T('el vendedor avanza Vacío → Completo → Cargado, pero no salta ni rinde', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '7' }); const id = idDe(m, '7'); m.llamar(GER, { action: 'contratos_asignar', ids: [id], responsable: 'Vendedor Carlos' });
  assert.strictEqual(m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Cargado' }).omitidos[0].motivo, 'transicion_no_permitida');
  assert.strictEqual(m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Completo', cliente: 'Pérez Juan' }).cambiados, 1);
  assert.strictEqual(m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Cargado' }).cambiados, 1);
  assert.strictEqual(m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Rendido', sellado: { forma: 'Contado', referencia: 'Ana OK' } }).error, 'sin_permiso');
  const c = datos(m, V1).contratos[0]; assert.strictEqual(c.estado, 'Cargado'); assert.strictEqual(c.cliente, 'Pérez Juan');
  assert.strictEqual(m.llamar(V2, { action: 'contratos_estado', ids: [id], estado: 'Completo' }).omitidos[0].motivo, 'no_es_suyo');
});
T('Rendido pide forma y referencia del sellado; solo supervisión; queda registrado', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '8' }); const id = idDe(m, '8'); m.llamar(GER, { action: 'contratos_asignar', ids: [id], responsable: 'Vendedor Carlos' });
  m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Completo' }); m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Cargado' });
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_estado', ids: [id], estado: 'Rendido' }).error, 'falta_forma_sellado');
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_estado', ids: [id], estado: 'Rendido', sellado: { forma: 'Transferencia' } }).error, 'falta_referencia_sellado');
  assert.strictEqual(m.llamar(JEF2, { action: 'contratos_estado', ids: [id], estado: 'Rendido', sellado: { forma: 'Transferencia', referencia: 'Op 123456' } }).omitidos[0].motivo, 'no_es_suyo');
  const r = m.llamar(JEF, { action: 'contratos_estado', ids: [id], estado: 'Rendido', sellado: { forma: 'Transferencia', referencia: 'Op 123456', monto: '12.500,50' } }); assert(r.ok && r.cambiados === 1);
  const c = datos(m, JEF).contratos[0]; assert.strictEqual(c.estado, 'Rendido'); assert.strictEqual(c.sellado_forma, 'Transferencia'); assert.strictEqual(c.sellado_ref, 'Op 123456'); assert.strictEqual(c.sellado_monto, 12500.5);
  assert.strictEqual(m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Completo' }).omitidos[0].motivo, 'ya_rendido');
  assert(m.libro.ContratosLog.filas.length >= 6); assert(m.libro.ContratosLog.filas.some(f => String(f[3]) === 'estado' && String(f[4]).includes('Rendido')));
});
T('un contrato Disponible no puede pasar de estado sin asignarse; anular es solo de gerencia y no rinde', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '9-10' }); const a = idDe(m, '9'), b = idDe(m, '10');
  assert.strictEqual(m.llamar(GER, { action: 'contratos_estado', ids: [a], estado: 'Completo' }).omitidos[0].motivo, 'primero_asignar');
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_estado', ids: [a], estado: 'Anulado' }).error, 'sin_permiso');
  assert.strictEqual(m.llamar(GER, { action: 'contratos_estado', ids: [a], estado: 'Anulado', notas: 'Extraviado' }).cambiados, 1);
  assert.strictEqual(datos(m, GER).contratos.find(c => c.id === a).estado, 'Anulado');
});
T('devolver a gerencia: el jefe devuelve lo que no repartió; no lo que ya está en proceso', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '20-21' }); const [a, b] = [idDe(m, '20'), idDe(m, '21')]; m.llamar(GER, { action: 'contratos_asignar', ids: [a, b], responsable: 'Jefe Ana' });
  m.llamar(JEF, { action: 'contratos_asignar', ids: [b], responsable: 'Vendedor Carlos' }); m.llamar(V1, { action: 'contratos_estado', ids: [b], estado: 'Completo' });
  let r = m.llamar(JEF, { action: 'contratos_asignar', ids: [a, b], responsable: '' }); assert.strictEqual(r.cambiados, 1); assert.strictEqual(r.omitidos[0].motivo, 'ya_en_proceso');
  const c = datos(m, GER).contratos.find(x => x.id === a); assert(c.estado === 'Disponible' && c.responsable === '');
});
T('importar lo ya repartido: crea, actualiza y avisa los errores por línea', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '500' });
  const texto = ['500;Vendedor Carlos;Completo;García Luis', '501;Jefe Ana;Vacío', '502;Vendedora Dana;Rendido', '503;Fulano;Vacío', '504;Vendedor Eli;Raro', '501;Jefe Ana;Vacío', '505', '###;Jefe Ana;Vacío', '506;;Cargado'].join('\n');
  const r = m.llamar(GER, { action: 'contratos_importar', texto }); assert(r.ok, JSON.stringify(r)); assert.strictEqual(r.creados, 3); assert.strictEqual(r.actualizados, 1); assert.strictEqual(r.errores.length, 5, JSON.stringify(r.errores));
  const d = datos(m, GER).contratos, g = n => d.find(c => c.numero === n);
  assert(g('500').estado === 'Completo' && g('500').responsable === 'Vendedor Carlos' && g('500').cliente === 'García Luis'); assert(g('502').estado === 'Rendido' && g('502').sellado_forma === 'Carga inicial'); assert(g('505').estado === 'Disponible');
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_importar', texto: '1;Jefe Ana' }).error, 'sin_permiso');
});
T('texto con fórmulas no se interpreta (cliente, notas, referencia)', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '30' }); const id = idDe(m, '30'); m.llamar(GER, { action: 'contratos_asignar', ids: [id], responsable: 'Vendedor Carlos' });
  m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Completo', cliente: '=HYPERLINK("x")' }); const fila = m.libro.Contratos.filas.find(f => String(f[1]) === '30'); assert(String(fila[6]).startsWith("'="), 'la fórmula debe guardarse como texto: ' + fila[6]);
});
console.log(`\n${ok} bien, ${fail} con error`); process.exit(fail ? 1 : 0);
