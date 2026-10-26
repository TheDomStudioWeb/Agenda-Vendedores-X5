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

T('rangos y listas de números', () => { const m = nuevo(); const r = m.api.expandirNumeros_('1001-1003, 1010 1011;1002 abc-9 ##'); assert.deepStrictEqual(Array.from(r.numeros), ['1001', '1002', '1003', '1010', '1011']); assert.strictEqual(r.problemas.length, 2); });
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
T('el jefe marca Recibido; Rendido solo gerencia, con forma y referencia del sellado; queda registrado', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '8' }); const id = idDe(m, '8'); m.llamar(GER, { action: 'contratos_asignar', ids: [id], responsable: 'Vendedor Carlos' });
  m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Completo' }); m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Cargado' });
  assert.strictEqual(m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Recibido' }).error, 'sin_permiso');
  assert.strictEqual(m.llamar(JEF2, { action: 'contratos_estado', ids: [id], estado: 'Recibido' }).omitidos[0].motivo, 'no_es_suyo');
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_estado', ids: [id], estado: 'Recibido' }).cambiados, 1);
  const sel = { forma: 'Transferencia', referencia: 'Op 123456', monto: '12.500,50' };
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_estado', ids: [id], estado: 'Rendido', sellado: sel }).error, 'sin_permiso');
  assert.strictEqual(m.llamar(GER, { action: 'contratos_estado', ids: [id], estado: 'Rendido' }).error, 'falta_forma_sellado');
  assert.strictEqual(m.llamar(GER, { action: 'contratos_estado', ids: [id], estado: 'Rendido', sellado: { forma: 'Transferencia' } }).error, 'falta_referencia_sellado');
  const r = m.llamar(GER, { action: 'contratos_estado', ids: [id], estado: 'Rendido', sellado: sel }); assert(r.ok && r.cambiados === 1);
  const c = datos(m, JEF).contratos[0]; assert.strictEqual(c.estado, 'Rendido'); assert.strictEqual(c.sellado_forma, 'Transferencia'); assert.strictEqual(c.sellado_ref, 'Op 123456'); assert.strictEqual(c.sellado_monto, 12500.5);
  assert.strictEqual(m.llamar(V1, { action: 'contratos_estado', ids: [id], estado: 'Completo' }).omitidos[0].motivo, 'ya_rendido');
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_estado', ids: [id], estado: 'Cargado' }).omitidos[0].motivo, 'ya_rendido');
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
T('venta en el CRM: el número pasa Vacío → Completo; avisa sin romper si no existe, es ajeno o está avanzado; corrección revierte el anterior', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '40-43' }); const ids = ['40', '41', '42', '43'].map(n => idDe(m, n));
  m.llamar(GER, { action: 'contratos_asignar', ids: ids.slice(0, 3), responsable: 'Jefe Ana' }); m.llamar(JEF, { action: 'contratos_asignar', ids: [ids[0], ids[1]], responsable: 'Vendedor Carlos' });
  const vi = (u, b) => m.llamar(u, Object.assign({ action: 'contratos_vincular' }, b)); const est = n => datos(m, GER).contratos.find(c => c.numero === n);
  assert.strictEqual(vi(V1, { numero: '40', cliente: 'Pérez' }).resultado, 'completado'); assert(est('40').estado === 'Completo' && est('40').cliente === 'Pérez');
  const r = vi(V1, { numero: '41', anterior: '40', cliente: 'Pérez' }); assert(r.resultado === 'completado' && r.revertido === '40'); assert(est('40').estado === 'Vacío' && est('41').estado === 'Completo');
  assert.strictEqual(vi(V1, { numero: '41', cliente: 'Otro' }).resultado, 'sin_cambio');
  assert.strictEqual(vi(V1, { numero: '42', cliente: 'X' }).resultado, 'no_es_suyo'); assert.strictEqual(est('42').estado, 'Vacío');
  assert.strictEqual(vi(V1, { numero: '43', cliente: 'X' }).resultado, 'no_es_suyo');
  assert.strictEqual(vi(V1, { numero: '999', cliente: 'X' }).resultado, 'no_existe');
  assert.strictEqual(vi(JEF, { numero: '42', cliente: 'X', asesor: 'Vendedor Carlos' }).resultado, 'completado');
  m.llamar(GER, { action: 'contratos_estado', ids: [ids[1]], estado: 'Cargado' }); assert.strictEqual(vi(V1, { numero: '40', anterior: '41', cliente: 'Pérez' }).revertido, false); assert.strictEqual(est('41').estado, 'Cargado');
});
const LISTA = 'CODIGO\tVEHÍCULO\tAPERTURA CARPETA\tADELANTO MENSUAL\tSELLADO\tPAGO 1 y 2\nPX61\tHonda Tornado XR 250\t10\t$ 90.000\t$ 40.000\t$ 130.000\nPX64\tVW Polo MSI / Peug 208 All\t10\t$ 250.000\t$ 50.000\t$ 300.000\nPX71\tVW Vento GLI\t5\t$ 600.000\t$ 100.000\t$ 700.000';
T('lista de precios: solo gerencia; pega con tabulaciones y $; todos la ven; actualizar vs reemplazar', () => {
  const m = nuevo(); assert.strictEqual(m.llamar(JEF, { action: 'contratos_precios_cargar', texto: LISTA }).error, 'sin_permiso');
  let r = m.llamar(GER, { action: 'contratos_precios_cargar', modo: 'reemplazar', texto: LISTA }); assert(r.ok && r.creados === 3, JSON.stringify(r));
  let p = m.llamar(V1, { action: 'contratos_precios' }).precios; assert.strictEqual(p.length, 3); const px = p.find(x => x.codigo === 'PX64'); assert(px.cuota === 250000 && px.sellado === 50000 && px.pago_1_y_2 === 300000 && String(px.apertura) === '10');
  r = m.llamar(GER, { action: 'contratos_precios_cargar', texto: 'PX64;VW Polo;10;260000;55000\nPX99;Nuevo;5;1.000.000;70.000,50\nPX98;Malo;5;abc;1' }); assert(r.ok && r.creados === 1 && r.actualizados === 1 && r.errores.length === 1);
  p = m.llamar(V1, { action: 'contratos_precios' }).precios; assert.strictEqual(p.length, 4); assert.strictEqual(p.find(x => x.codigo === 'PX64').sellado, 55000); assert.strictEqual(p.find(x => x.codigo === 'PX64').pago_1_y_2, 315000); assert(p.find(x => x.codigo === 'PX99').cuota === 1000000 && p.find(x => x.codigo === 'PX99').sellado === 70000.5);
  r = m.llamar(GER, { action: 'contratos_precios_cargar', modo: 'reemplazar', texto: 'PX61;Moto;10;1;2\nXX;Mal;1;x;y' }); assert(!r.ok && r.error === 'hay_errores'); assert.strictEqual(m.llamar(V1, { action: 'contratos_precios' }).precios.length, 4);
  r = m.llamar(GER, { action: 'contratos_precios_cargar', modo: 'reemplazar', texto: LISTA }); assert(r.ok); assert.strictEqual(m.llamar(V1, { action: 'contratos_precios' }).precios.length, 3);
});
T('venta con código: copia cuota y sellado al contrato; código inválido no cambia nada; rendir usa el sellado del contrato', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_precios_cargar', modo: 'reemplazar', texto: LISTA }); m.llamar(GER, { action: 'contratos_cargar', numeros: '60-62' });
  const ids = ['60', '61', '62'].map(n => idDe(m, n)); m.llamar(GER, { action: 'contratos_asignar', ids: ids, responsable: 'Vendedor Carlos' });
  const vi = b => m.llamar(V1, Object.assign({ action: 'contratos_vincular', cliente: 'Pérez' }, b)); const est = n => datos(m, GER).contratos.find(c => c.numero === n);
  assert.strictEqual(vi({ numero: '60', codigo: 'ZZ' }).resultado, 'codigo_invalido'); assert.strictEqual(est('60').estado, 'Vacío');
  let r = vi({ numero: '60', codigo: 'px64' }); assert(r.resultado === 'completado' && r.sellado === 50000 && r.cuota === 250000);
  assert(est('60').plan_codigo === 'PX64' && est('60').sellado_debido === 50000 && est('60').plan_cuota === 250000);
  vi({ numero: '60', anterior: '60', codigo: 'PX71' }); assert.strictEqual(est('60').sellado_debido, 100000);
  r = vi({ numero: '61', anterior: '60', codigo: 'PX61' }); assert(est('60').estado === 'Vacío' && est('60').sellado_debido === '' && est('61').sellado_debido === 40000);
  m.llamar(V1, { action: 'contratos_estado', ids: [ids[1]], estado: 'Cargado' }); m.llamar(JEF, { action: 'contratos_estado', ids: [ids[1]], estado: 'Recibido' });
  assert(m.llamar(GER, { action: 'contratos_estado', ids: [ids[1]], estado: 'Rendido', sellado: { forma: 'Contado', referencia: 'Ana OK' } }).ok); assert.strictEqual(est('61').sellado_monto, 40000);
});
T('lista de precios pegada con comas y espacio (como llega desde Word)', () => {
  const m = nuevo(); const txt = 'PX61, Honda Tornado XR 250, 10, $ 90.000, $ 40.000, $ 130.000\nPX64, VW Polo MSI / Peug 208 All / Fiat Cronos, 10, $ 250.000, $ 50.000, $ 300.000\nPX72, Toyota SW4 4x4 SRX, 5, $ 700.000, $ 150.000, $ 850.000';
  const r = m.llamar(GER, { action: 'contratos_precios_cargar', modo: 'reemplazar', texto: txt }); assert(r.ok && r.creados === 3 && r.errores.length === 0, JSON.stringify(r));
  const p = m.llamar(V1, { action: 'contratos_precios' }).precios; assert(p[1].vehiculo === 'VW Polo MSI / Peug 208 All / Fiat Cronos' && p[1].cuota === 250000 && p[1].sellado === 50000 && p[2].pago_1_y_2 === 850000);
});
T('importar rechaza números con letras (línea mal armada) y gerencia puede eliminar los cargados por error', () => {
  const m = nuevo(); const r = m.llamar(GER, { action: 'contratos_importar', texto: '63039-DanielArancibia\n63040;Gerente Uno;Vacío' }); assert(r.ok && r.creados === 1 && r.errores.length === 1 && r.errores[0].motivo.includes('faltan los ;'));
  m.llamar(GER, { action: 'contratos_cargar', numeros: '70-71' }); const a = idDe(m, '70'), b = idDe(m, '63040');
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_eliminar', ids: [a] }).error, 'sin_permiso');
  const e = m.llamar(GER, { action: 'contratos_eliminar', ids: [a, b] }); assert(e.ok && e.eliminados === 1 && e.omitidos.length === 1);
  const n = datos(m, GER).contratos.map(c => c.numero); assert(!n.includes('70') && n.includes('71') && n.includes('63040'));
});
console.log(`\n${ok} bien, ${fail} con error`); process.exit(fail ? 1 : 0);
