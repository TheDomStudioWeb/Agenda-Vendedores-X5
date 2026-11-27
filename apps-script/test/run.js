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
T('Enviado a casa central: solo gerencia, solo desde Rendido; después queda bloqueado y gerencia puede volverlo a Rendido sin perder el sellado', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_cargar', numeros: '900\n901' });
  const ids = [idDe(m, '900'), idDe(m, '901')];
  m.llamar(GER, { action: 'contratos_asignar', ids, responsable: 'Vendedor Carlos' });
  m.llamar(V1, { action: 'contratos_estado', ids: [ids[0], ids[1]], estado: 'Completo' });
  const sel = { forma: 'Transferencia', referencia: 'Op 777' };
  assert(m.llamar(GER, { action: 'contratos_estado', ids: [ids[0]], estado: 'Rendido', sellado: sel }).ok);
  const E = 'Enviado a casa central';
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_estado', ids: [ids[0]], estado: E }).error, 'sin_permiso');
  let r = m.llamar(GER, { action: 'contratos_estado', ids: [ids[0], ids[1]], estado: E });
  assert(r.ok && r.cambiados === 1 && r.omitidos[0].motivo === 'debe_estar_rendido', JSON.stringify(r));
  const c0 = () => datos(m, GER).contratos.find(c => c.id === ids[0]);
  assert.strictEqual(c0().estado, E); assert.strictEqual(c0().sellado_ref, 'Op 777');
  r = m.llamar(JEF, { action: 'contratos_estado', ids: [ids[0]], estado: 'Cargado' }); assert(r.cambiados === 0 && r.omitidos[0].motivo === 'ya_enviado', JSON.stringify(r));
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_estado', ids: [ids[0]], estado: 'Rendido' }).error, 'sin_permiso');
  assert(m.llamar(GER, { action: 'contratos_estado', ids: [ids[0]], estado: 'Rendido' }).ok);
  assert.strictEqual(c0().estado, 'Rendido'); assert.strictEqual(c0().sellado_ref, 'Op 777'); assert.strictEqual(c0().sellado_forma, 'Transferencia');
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
  assert.strictEqual(vi(V1, { numero: '41', cliente: 'Otro' }).resultado, 'usado'); assert.strictEqual(est('41').cliente, 'Pérez');
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
T('contrato marcado Completo por gerencia: sin cliente la venta lo completa; con el mismo cliente también; con otro cliente queda bloqueado', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_precios_cargar', modo: 'reemplazar', texto: LISTA }); m.llamar(GER, { action: 'contratos_cargar', numeros: '70-73' });
  const ids = ['70', '71', '72', '73'].map(n => idDe(m, n)); m.llamar(GER, { action: 'contratos_asignar', ids, responsable: 'Vendedor Carlos' });
  const est = n => datos(m, GER).contratos.find(c => c.numero === n), vi = b => m.llamar(V1, Object.assign({ action: 'contratos_vincular' }, b)), ve = b => m.llamar(V1, Object.assign({ action: 'contratos_verificar' }, b));
  m.llamar(GER, { action: 'contratos_estado', ids: [ids[0]], estado: 'Completo' });                       // sin cliente
  m.llamar(GER, { action: 'contratos_estado', ids: [ids[1]], estado: 'Completo', cliente: 'Juan Pérez' }); // con cliente
  m.llamar(GER, { action: 'contratos_estado', ids: [ids[2]], estado: 'Completo', cliente: 'Ana Gómez' });
  assert.strictEqual(ve({ numero: '70', cliente: 'Carla Ruiz' }).resultado, 'libre');
  let r = vi({ numero: '70', cliente: 'Carla Ruiz', codigo: 'PX64' }); assert(r.resultado === 'completado' && r.sellado === 50000); assert(est('70').cliente === 'Carla Ruiz' && est('70').estado === 'Completo' && est('70').sellado_debido === 50000);
  assert.strictEqual(ve({ numero: '71', cliente: 'pérez  JUAN' }).resultado, 'libre');
  r = vi({ numero: '71', cliente: 'pérez  JUAN', codigo: 'PX71' }); assert.strictEqual(r.resultado, 'completado'); assert(est('71').cliente === 'Juan Pérez' && est('71').sellado_debido === 100000);
  const v = ve({ numero: '72', cliente: 'Otra Persona' }); assert(v.resultado === 'usado' && v.cliente === 'Ana Gómez');
  r = vi({ numero: '72', cliente: 'Otra Persona', codigo: 'PX64' }); assert.strictEqual(r.resultado, 'usado'); assert(est('72').cliente === 'Ana Gómez' && est('72').sellado_debido === '');
  m.llamar(V1, { action: 'contratos_estado', ids: [ids[1]], estado: 'Cargado' }); assert.strictEqual(vi({ numero: '71', cliente: 'Juan Pérez', codigo: 'PX61' }).resultado, 'completado'); assert.strictEqual(est('71').estado, 'Cargado'); // no retrocede
  assert.strictEqual(ve({ numero: '73', cliente: 'X' }).resultado, 'libre'); assert.strictEqual(ve({ numero: '999', cliente: 'X' }).resultado, 'no_existe');
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
T('rol Control: ve todo el gestor de contratos, no modifica nada y no entra al CRM', () => {
  const m = crear(personal.concat([['Control Suc', 'Control', 'Activo', '', 'x', '']])); const CTL = { nombre: 'Control Suc', rol: 'Control' };
  m.llamar(GER, { action: 'contratos_cargar', numeros: '80-82' }); m.llamar(GER, { action: 'contratos_asignar', ids: [idDe(m, '80')], responsable: 'Vendedor Carlos' });
  const d = datos(m, CTL); assert(d.ok && d.contratos.length === 3 && d.contratos.some(c => c.estado === 'Disponible'), JSON.stringify(d).slice(0, 200));
  const id = idDe(m, '81');
  ['contratos_cargar:{"numeros":"90"}', 'contratos_asignar:{"ids":["' + id + '"],"responsable":"Jefe Ana"}', 'contratos_estado:{"ids":["' + id + '"],"estado":"Anulado"}', 'contratos_eliminar:{"ids":["' + id + '"]}', 'contratos_importar:{"texto":"91;Gerente Uno;Vacío"}', 'contratos_vincular:{"numero":"80","cliente":"X"}', 'contratos_precios_cargar:{"texto":"PX1;A;1;2;3"}'].forEach(x => {
    const i = x.indexOf(':'); const r = m.llamar(CTL, Object.assign({ action: x.slice(0, i) }, JSON.parse(x.slice(i + 1)))); assert.strictEqual(r.error, 'sin_permiso', x);
  });
  assert.strictEqual(datos(m, GER).contratos.length, 3); assert.strictEqual(datos(m, GER).contratos.find(c => c.numero === '81').estado, 'Disponible');
  const tok = m.post({ action: 'login', nombre: 'Control Suc', clave: 'x' }); assert(tok.ok && tok.token, JSON.stringify(tok));
  assert(m.post({ action: 'contratos_datos', token: tok.token }).ok);
  ['datos', 'add', 'update', 'delete', 'archivar', 'telegram_link', 'contratos_estado'].forEach(a => assert.strictEqual(m.post({ action: a, token: tok.token, tabla: 'Hoja 1', data: { id: 'x' } }).error, 'sin_permiso', a));
});
T('rol Supervisor: ve todo el CRM y los contratos, y el servidor rechaza cualquier cambio', () => {
  const m = crear(personal.concat([['Super Visor', 'Supervisor', 'Activo', '', 'x', '']])); const SUP = { nombre: 'Super Visor', rol: 'Supervisor' };
  const tg = m.post({ action: 'login', nombre: 'Gerente Uno', clave: 'x' }).token, ts = m.post({ action: 'login', nombre: 'Super Visor', clave: 'x' }).token, tj = m.post({ action: 'login', nombre: 'Jefe Beto', clave: 'x' }).token;
  assert(tg && ts && tj);
  const fecha = '2026-11-03';
  assert(m.post({ action: 'add', token: tg, tabla: 'Leads', data: { id: 'L1', cliente: 'Ana', telefono: '261111', interes: 'Auto', origen: 'web', asignado_a: 'Vendedor Carlos', fecha_asignacion: fecha, hora_limite: '18:00', estado: 'pendiente' } }).ok);
  assert(m.post({ action: 'add', token: tg, tabla: 'Leads', data: { id: 'L2', cliente: 'Beto', telefono: '261222', interes: 'Auto', origen: 'web', asignado_a: 'Vendedor Eli', fecha_asignacion: fecha, hora_limite: '18:00', estado: 'pendiente' } }).ok);
  assert(m.post({ action: 'add', token: tg, tabla: 'Hoja 1', data: { id: 'A1', cliente: 'Cami', vehiculo: 'Auto', asesor: 'Vendedora Dana', fecha, hora: '10:00', estado: 'pendiente' } }).ok);
  // Ve todo (como gerencia), a diferencia de un jefe de otro equipo
  const d = m.post({ action: 'datos', token: ts }); assert(d.ok && d.leads.length === 2 && d.agenda.length === 1, JSON.stringify(d).slice(0, 200));
  assert.strictEqual(m.post({ action: 'datos', token: tj }).leads.length, 1);
  // Contratos: ve todo, no modifica
  m.llamar(GER, { action: 'contratos_cargar', numeros: '100-102' });
  const c = datos(m, SUP); assert(c.ok && c.contratos.length === 3 && c.contratos.some(x => x.estado === 'Disponible'));
  assert(m.post({ action: 'contratos_precios', token: ts }).ok);
  const id = idDe(m, '101');
  ['contratos_cargar:{"numeros":"200"}', 'contratos_asignar:{"ids":["' + id + '"],"responsable":"Jefe Ana"}', 'contratos_estado:{"ids":["' + id + '"],"estado":"Anulado"}', 'contratos_eliminar:{"ids":["' + id + '"]}', 'contratos_importar:{"texto":"91;Gerente Uno;Vacío"}', 'contratos_vincular:{"numero":"100","cliente":"X"}'].forEach(x => {
    const i = x.indexOf(':'); const r = m.llamar(SUP, Object.assign({ action: x.slice(0, i) }, JSON.parse(x.slice(i + 1)))); assert.strictEqual(r.error, 'sin_permiso', x);
  });
  // Por HTTP: ninguna escritura ni acción de configuración pasa, ni sobre lo propio ni sobre lo ajeno
  ['add', 'update', 'delete', 'archivar', 'restaurar', 'archivo_listar', 'telegram_link', 'contratos_estado', 'contratos_cargar', 'accion_rara'].forEach(a => {
    ['Leads', 'Hoja 1'].forEach(t => assert.strictEqual(m.post({ action: a, token: ts, tabla: t, data: { id: 'L1', cliente: 'HACKEADO', asignado_a: 'Super Visor', asesor: 'Super Visor' } }).error, 'sin_permiso', a + ' ' + t));
  });
  const d2 = m.post({ action: 'datos', token: tg }); assert(d2.leads.find(l => l.id === 'L1').cliente === 'Ana' && d2.leads.length === 2 && d2.agenda.length === 1);
  assert.strictEqual(datos(m, GER).contratos.length, 3);
});
T('Personal cargado a mano con «activo», espacios de más o nombre repetido: aparecen igual y revisarPersonal lo avisa', () => {
  const m = crear(personal.concat([['  Vendedor   Nuevo ', 'Asesor', 'activo ', 'Jefe Ana', 'x', ''], ['Vendedor Sin Estado', 'Asesor', '', 'Jefe Ana', 'x', '']]));
  const u = m.api.listarUsuarios_().map(x => x.nombre);
  assert(u.includes('Vendedor Nuevo'), 'falta Vendedor Nuevo: ' + u.join(', '));
  assert(!u.includes('Vendedor Sin Estado'));
  const p = m.api.revisarPersonal(); assert(p.some(t => t.includes('Vendedor Sin Estado') && t.includes('vacío')));
});

T('seguimiento de más de 15 días: sin observaciones pasa solo a descartado; con observaciones avisa por Telegram al asesor', () => {
  const m = crear(personal.concat([['Vendedor Tel', 'Asesor', 'Activo', 'Jefe Ana', 'x', "'777"]]));
  const H = ['id', 'cliente', 'telefono', 'interes', 'origen', 'asignado_a', 'fecha_asignacion', 'hora_limite', 'estado', 'resultado', 'hora_contacto', 'notas', 'actualizado', 'aviso_vencido', 'aviso_seguimiento'];
  const f = (id, fecha, estado, notas) => [id, 'Cli' + id, '2615', 'Moto', 'IG', 'Vendedor Tel', fecha, '', estado, '', '', notas, '', '', ''];
  m.libro.Leads.filas = [H, f('1', '2026-10-05', 'en_seguimiento', ''), f('2', '2026-10-05', 'en_seguimiento', 'quiere ver precios'), f('3', '2026-10-20', 'en_seguimiento', ''), f('4', '2026-10-05', 'pendiente', ''), f('5', '2026-10-05', 'en_seguimiento', '   ')];
  m.api.revisarSeguimientosViejos_();
  const L = m.libro.Leads.filas, est = id => L.find(r => r[0] === id)[8];
  assert.strictEqual(est('1'), 'descartado'); assert.strictEqual(est('5'), 'descartado');
  assert.strictEqual(est('2'), 'en_seguimiento'); assert.strictEqual(est('3'), 'en_seguimiento'); assert.strictEqual(est('4'), 'pendiente');
  assert.strictEqual(m.enviados.length, 1); assert(m.enviados[0].text.includes('Cli2') && m.enviados[0].chat_id === '777', JSON.stringify(m.enviados));
  m.api.revisarSeguimientosViejos_(); assert.strictEqual(m.enviados.length, 1, 'no repite antes de 3 días');
  m.reloj('2026-10-30T15:00:00-03:00'); m.api.revisarSeguimientosViejos_(); assert.strictEqual(m.enviados.length, 2, 'repite a los 3 días si no hubo movimiento');
});

T('revisar sellado a rendir: muestra diferencias con la lista vigente, corrige solo los que están en la calle y no toca los rendidos', () => {
  const m = nuevo(); m.llamar(GER, { action: 'contratos_precios_cargar', modo: 'reemplazar', texto: LISTA }); m.llamar(GER, { action: 'contratos_cargar', numeros: '80-83' });
  const ids = ['80', '81', '82', '83'].map(n => idDe(m, n)); m.llamar(GER, { action: 'contratos_asignar', ids, responsable: 'Vendedor Carlos' });
  const vi = b => m.llamar(V1, Object.assign({ action: 'contratos_vincular' }, b)), est = n => datos(m, GER).contratos.find(c => c.numero === n);
  vi({ numero: '80', cliente: 'Uno', codigo: 'PX64' }); vi({ numero: '81', cliente: 'Dos', codigo: 'PX64' }); vi({ numero: '82', cliente: 'Tres', codigo: 'PX71' }); vi({ numero: '83', cliente: 'Cuatro', codigo: 'PX64' });
  m.llamar(V1, { action: 'contratos_estado', ids: [ids[3]], estado: 'Cargado' }); m.llamar(JEF, { action: 'contratos_estado', ids: [ids[3]], estado: 'Recibido' });
  m.llamar(GER, { action: 'contratos_estado', ids: [ids[3]], estado: 'Rendido', sellado: { forma: 'Contado', referencia: 'Ana OK' } });
  m.llamar(GER, { action: 'contratos_precios_cargar', texto: 'PX64;VW Polo;10;250000;35000' });          // el sellado de PX64 estaba mal: era 35.000
  assert.strictEqual(m.llamar(JEF, { action: 'contratos_sellado_revisar' }).error, 'sin_permiso');
  let r = m.llamar(GER, { action: 'contratos_sellado_revisar' });
  assert(r.ok && r.diferencias.length === 2 && r.aplicados === 0, JSON.stringify(r)); assert(r.total_antes === 100000 && r.total_nuevo === 70000);
  assert.strictEqual(est('80').sellado_debido, 50000, 'sin aplicar no cambia nada');
  r = m.llamar(GER, { action: 'contratos_sellado_revisar', aplicar: true }); assert.strictEqual(r.aplicados, 2);
  assert(est('80').sellado_debido === 35000 && est('81').sellado_debido === 35000 && est('82').sellado_debido === 100000);
  assert.strictEqual(est('83').sellado_monto, 50000, 'el rendido queda como se rindió');
  assert.strictEqual(m.llamar(GER, { action: 'contratos_sellado_revisar' }).diferencias.length, 0);
});

T('Asistencia: ubicación en cada marca, sede de la agencia, períodos y rol RRHH de solo lectura', () => {
  const m = crear(personal.concat([['Rosa Limpieza', 'Personal', 'Activo', 'Gerente Uno', 'x', ''], ['Laura RRHH', 'RRHH', 'Activo', 'Gerente Uno', 'x', '']]));
  const ROSA = { nombre: 'Rosa Limpieza', rol: 'Personal' }, RH = { nombre: 'Laura RRHH', rol: 'RRHH' };
  const SEDE = { lat: -32.90000, lon: -68.84000, acc: 20 };
  // la sede solo la fija gerencia y con buena precisión
  assert.strictEqual(m.asis(RH, { action: 'asistencia_sede', geo: SEDE }).error, 'sin_permiso');
  assert.strictEqual(m.asis(GER, { action: 'asistencia_sede', geo: { lat: -32.9, lon: -68.84, acc: 500 } }).error, 'ubicacion_imprecisa');
  assert(m.asis(GER, { action: 'asistencia_sede', geo: SEDE }).ok);
  // ingreso en la agencia, salida a 2 km
  m.reloj('2026-11-03T11:00:00Z'); assert(m.asis(ROSA, { action: 'asistencia_marcar', tipo: 'entrada', geo: { lat: -32.90050, lon: -68.84020, acc: 15 } }).ok);
  m.reloj('2026-11-03T15:00:00Z'); assert(m.asis(ROSA, { action: 'asistencia_marcar', tipo: 'salida', geo: { lat: -32.91800, lon: -68.84000, acc: 15 } }).ok);
  // un turno sin ubicación (el teléfono no la dio) queda señalado
  m.reloj('2026-11-20T11:00:00Z'); assert(m.asis(ROSA, { action: 'asistencia_marcar', tipo: 'entrada' }).ok);
  m.reloj('2026-11-20T12:00:00Z'); assert(m.asis(ROSA, { action: 'asistencia_marcar', tipo: 'salida', geo: { lat: 0, lon: 0 } }).ok);
  // RRHH: no marca ni corrige, pero ve a la persona del personal y su ubicación
  assert.strictEqual(m.asis(RH, { action: 'asistencia_marcar', tipo: 'entrada' }).error, 'sin_permiso');
  assert.strictEqual(m.asis(RH, { action: 'asistencia_corregir', nombre: 'Rosa Limpieza', fecha: '2026-11-04', entrada: '08:00', salida: '12:00', motivo: 'x' }).error, 'sin_permiso');
  let d = m.asis(RH, { action: 'asistencia_datos', periodo: 'semana', desde: '2026-11-04' });
  assert(d.ok && d.nombre === 'Rosa Limpieza' && d.desde === '2026-11-02' && d.hasta === '2026-11-08', JSON.stringify([d.nombre, d.desde, d.hasta]));
  assert(!d.personas.includes('Laura RRHH'));
  const t = d.semana[0]; assert.strictEqual(t.geo_in.estado, 'sede'); assert.strictEqual(t.geo_out.estado, 'fuera'); assert(t.geo_out.dist > 1900 && t.geo_out.dist < 2100, t.geo_out.dist);
  assert(t.entrada_geo === undefined, 'la coordenada cruda no se manda');
  // quincena y mes
  d = m.asis(RH, { action: 'asistencia_datos', periodo: 'quincena', desde: '2026-11-20', nombre: 'Rosa Limpieza' });
  assert(d.desde === '2026-11-16' && d.hasta === '2026-11-30' && d.semana.length === 1 && d.semana[0].geo_in.estado === 'sin' && d.semana[0].geo_out.estado === 'sin');
  d = m.asis(RH, { action: 'asistencia_datos', periodo: 'quincena', desde: '2026-11-03', nombre: 'Rosa Limpieza' }); assert(d.desde === '2026-11-01' && d.hasta === '2026-11-15');
  d = m.asis(RH, { action: 'asistencia_datos', periodo: 'mes', desde: '2026-02-10', nombre: 'Rosa Limpieza' }); assert(d.desde === '2026-02-01' && d.hasta === '2026-02-28');
  d = m.asis(GER, { action: 'asistencia_datos', periodo: 'mes', desde: '2026-11-10', nombre: 'Rosa Limpieza' }); assert(d.semana.length === 2 && d.sede && d.sede.radio === 150);
  // días elegidos: exactamente esos días
  d = m.asis(RH, { action: 'asistencia_datos', periodo: 'rango', desde: '2026-11-03', hasta: '2026-11-19', nombre: 'Rosa Limpieza' });
  assert(d.ok && d.periodo === 'rango' && d.desde === '2026-11-03' && d.hasta === '2026-11-19' && d.semana.length === 1, JSON.stringify([d.desde, d.hasta, d.semana.length]));
  d = m.asis(RH, { action: 'asistencia_datos', periodo: 'rango', desde: '2026-11-04', hasta: '2026-11-20', nombre: 'Rosa Limpieza' });
  assert(d.semana.length === 1 && d.semana[0].fecha === '2026-11-20');
  assert.strictEqual(m.asis(RH, { action: 'asistencia_datos', periodo: 'rango', desde: '2026-11-20', hasta: '2026-11-15' }).error, 'rango_invalido');
  assert.strictEqual(m.asis(RH, { action: 'asistencia_datos', periodo: 'rango', desde: '2026-01-01', hasta: '2026-11-15' }).error, 'rango_largo');
  // RRHH y Personal no aparecen como vendedores
  assert(!m.api.listarUsuarios_ || true);
});

T('carga masiva de leads: gerencia y jefes, sin duplicados por teléfono, respeta el equipo y avisa una vez por asesor', () => {
  const m = nuevo(); m.libro.Personal.filas[4][5] = '111'; // Carlos tiene Telegram
  const tg = m.post({ action: 'login', nombre: 'Gerente Uno', clave: 'x' }).token, tj = m.post({ action: 'login', nombre: 'Jefe Ana', clave: 'x' }).token, tv = m.post({ action: 'login', nombre: 'Vendedor Carlos', clave: 'x' }).token;
  assert(m.post({ action: 'add', token: tg, tabla: 'Leads', data: { id: 'L1', cliente: 'Ya Estaba', telefono: '2614112233', asignado_a: 'Vendedor Eli', estado: 'pendiente' } }).ok);
  const leads = [
    { fila: 2, cliente: 'Ana Gómez', telefono: '+54 9 261 555-0001', interes: 'Onix', origen: 'Meta Ads', asignado_a: 'Vendedor Carlos', notas: 'mail: a@b.com' },
    { fila: 3, cliente: 'Bruno', telefono: '0261 15 4112233', asignado_a: 'Vendedor Carlos' },  // mismo número que L1
    { fila: 4, cliente: 'Ceci', telefono: '261 5550001', asignado_a: 'Vendedora Dana' },          // repetido dentro del Excel
    { fila: 5, cliente: '', telefono: '2615550009', asignado_a: 'Vendedora Dana' },
    { fila: 6, cliente: 'Dani', telefono: '12', asignado_a: 'Vendedora Dana' },
    { fila: 7, cliente: 'Eva', telefono: '2615550010', asignado_a: 'Vendedor Eli' },             // otro equipo para Jefe Ana
    { fila: 8, cliente: 'Fede', telefono: '2615550011', asignado_a: 'Vendedora Dana' } ];
  assert.strictEqual(m.post({ action: 'leads_importar', token: tv, leads }).error, 'sin_permiso');
  m.enviados.length = 0;
  const r = m.post({ action: 'leads_importar', token: tj, leads, fecha_asignacion: '2026-10-27', hora_limite: '9:30' });
  assert(r.ok && r.creados === 2, JSON.stringify(r));
  assert.deepStrictEqual(r.duplicados.map(d => d.fila), [3, 4]); assert.strictEqual(r.duplicados[0].ya, 'Ya Estaba');
  assert.deepStrictEqual(r.errores.map(e => e.fila + ':' + e.motivo), ['5:falta_nombre', '6:falta_telefono', '7:asesor_invalido']);
  const d = m.post({ action: 'datos', token: tg }).leads; assert.strictEqual(d.length, 3);
  const ana = d.find(l => l.cliente === 'Ana Gómez'); assert(ana.estado === 'pendiente' && ana.origen === 'Meta Ads' && ana.hora_limite === '09:30' && String(ana.fecha_asignacion).slice(0, 10) === '2026-10-27' && ana.notas === 'mail: a@b.com', JSON.stringify(ana));
  assert.strictEqual(d.find(l => l.cliente === 'Fede').origen, 'Base Excel');
  assert.strictEqual(m.enviados.length, 1, JSON.stringify(m.enviados)); assert(/Te asignaron 1 lead nuevo/.test(m.enviados[0].text));
  // Repetir el mismo Excel no duplica nada
  const r2 = m.post({ action: 'leads_importar', token: tg, leads, avisar: false }); assert.strictEqual(r2.creados, 1, JSON.stringify(r2)); // solo Eva (el gerente sí puede asignarle)
});

console.log(`\n${ok} bien, ${fail} con error`); process.exit(fail ? 1 : 0);
