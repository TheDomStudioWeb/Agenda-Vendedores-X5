// Pruebas del Radar: reservas compartidas, permisos, vencimiento, retoques, proveedores y lectura pública.
const assert = require('assert'), { crear } = require('./mock');
const GER = { nombre: 'Gerente Uno', rol: 'Gerente Comercial' }, JEF = { nombre: 'Jefe Ana', rol: 'Jefe de Ventas' }, SUPV = { nombre: 'Super Visor', rol: 'Supervisor' };
const V1 = { nombre: 'Vendedor Carlos', rol: 'Asesor' }, V2 = { nombre: 'Vendedora Dana', rol: 'Asesor' };
const personal = [['Gerente Uno', 'Gerente Comercial', 'Activo', '', 'x', '111'], ['Jefe Ana', 'Jefe de Ventas', 'Activo', 'Gerente Uno', 'x', '222'],
  ['Vendedor Carlos', 'Asesor', 'Activo', 'Jefe Ana', 'x', '333'], ['Vendedora Dana', 'Asesor', 'Activo', 'Jefe Ana', 'x', '444'], ['Super Visor', 'Supervisor', 'Activo', '', 'x', '']];
let ok = 0, fail = 0;
const T = (n, f) => { try { f(); ok++; console.log('  ✓ ' + n); } catch (e) { fail++; console.log('  ✗ ' + n + '\n    ' + (e.stack || e).split('\n').slice(0, 3).join('\n    ')); } };
const AUTO = { id: 'maipu-1', desc: 'Toyota Hilux 2021 2.8 SRX', agencia: 'maipu', precio_x5: 42000000, url: 'https://ejemplo/hilux' };
const reservar = (m, u, extra) => m.radar(u, Object.assign({ action: 'radar_reservar', auto: AUTO, cliente: 'Pérez Juan', telefono: '261 555-1234' }, extra || {}));
const datos = (m, u) => m.radar(u, { action: 'radar_datos' });

T('un negociador reserva y la unidad queda bloqueada para los demás', () => {
  const m = crear(personal); const r = reservar(m, V1); assert(r.ok && r.reserva.mia);
  const r2 = reservar(m, V2, { cliente: 'Otro' }); assert.strictEqual(r2.error, 'ya_reservado'); assert.strictEqual(r2.por, 'Vendedor Carlos');
  const d = datos(m, V2); assert.strictEqual(d.reservas.length, 1); assert.strictEqual(d.reservas[0].mia, false); assert.strictEqual(d.reservas[0].cliente, undefined, 'otro negociador no ve el cliente');
  const d1 = datos(m, V1); assert.strictEqual(d1.reservas[0].cliente, 'Pérez Juan'); assert.strictEqual(d1.reservas[0].telefono, '2615551234');
});
T('sin cliente no se puede reservar', () => { const m = crear(personal); assert.strictEqual(reservar(m, V1, { cliente: ' ' }).error, 'falta_cliente'); });
T('al reservar se avisa por Telegram a gerencia y al jefe, con botón al WhatsApp del proveedor', () => {
  const m = crear(personal); m.libro.RadarProveedores = null;
  assert(m.radar(GER, { action: 'radar_proveedor_guardar', proveedor: { id: 'maipu', nombre: 'Maipú Usados', whatsapp: '351 444-5566' } }).ok);
  m.enviados.length = 0; reservar(m, V1);
  const a = m.enviados.filter(x => x.text && /Reserva nueva/.test(x.text)); assert.strictEqual(a.length, 2, 'gerente y jefe');
  const boton = a[0].reply_markup.inline_keyboard[0][0]; assert(/^https:\/\/wa\.me\/5493514445566\?text=/.test(boton.url)); assert(/reservar/i.test(decodeURIComponent(boton.url)));
});
T('el asesor no ve el WhatsApp del proveedor; supervisión sí', () => {
  const m = crear(personal); m.radar(GER, { action: 'radar_proveedor_guardar', proveedor: { id: 'maipu', nombre: 'Maipú Usados', whatsapp: '3514445566' } });
  assert.strictEqual(datos(m, V1).proveedores[0].whatsapp, undefined); assert.strictEqual(datos(m, JEF).proveedores[0].whatsapp, '3514445566');
  assert.strictEqual(m.radar(JEF, { action: 'radar_proveedor_guardar', proveedor: { id: 'x', nombre: 'X' } }).error, 'sin_permiso');
});
T('liberar: el dueño o supervisión; otro asesor no. Después se puede reservar de nuevo', () => {
  const m = crear(personal); const id = reservar(m, V1).reserva.id;
  assert.strictEqual(m.radar(V2, { action: 'radar_liberar', id }).error, 'sin_permiso');
  assert(m.radar(JEF, { action: 'radar_liberar', id }).ok);
  assert.strictEqual(datos(m, V1).reservas.length, 0); assert(reservar(m, V2, { cliente: 'Otro' }).ok);
});
T('vendida: queda bloqueada y figura como vendida (no se puede volver a reservar)', () => {
  const m = crear(personal); const id = reservar(m, V1).reserva.id; assert(m.radar(V1, { action: 'radar_vendida', id }).ok);
  assert.strictEqual(reservar(m, V2, { cliente: 'Otro' }).error, 'ya_vendido'); assert.strictEqual(datos(m, V2).reservas[0].estado, 'Vendida');
  const pub = m.api.radarEstadoPublico_(); assert.deepStrictEqual(Array.from(pub.vendidos), ['maipu-1']); assert.strictEqual(pub.reservados.length, 0);
});
T('vence sola a las 48 h: aviso 2 h antes al negociador, al vencer pasa a Vencida y se libera', () => {
  const m = crear(personal); reservar(m, V1); m.enviados.length = 0;
  m.reloj('2026-10-28T13:30:00-03:00'); m.api.revisarReservas_();
  assert(m.enviados.some(x => /vence en menos de 2 horas/.test(x.text || '') && x.chat_id === '333'));
  m.reloj('2026-10-28T15:01:00-03:00'); m.api.revisarReservas_();
  assert(m.enviados.some(x => /Reserva vencida/.test(x.text || ''))); assert(m.enviados.some(x => /Venció tu reserva/.test(x.text || '') && x.chat_id === '333'));
  assert.strictEqual(datos(m, V1).reservas.length, 0); assert(reservar(m, V2, { cliente: 'Otro' }).ok);
});
T('extender: el negociador una sola vez; supervisión más veces', () => {
  const m = crear(personal); const id = reservar(m, V1).reserva.id;
  const e1 = m.radar(V1, { action: 'radar_extender', id }); assert(e1.ok && new Date(e1.vence) > new Date('2026-10-29T14:00:00-03:00'));
  assert.strictEqual(m.radar(V1, { action: 'radar_extender', id }).error, 'ya_extendida'); assert(m.radar(JEF, { action: 'radar_extender', id }).ok);
});
T('el supervisor (solo lectura) ve las reservas pero no reserva', () => {
  const m = crear(personal); reservar(m, V1); assert.strictEqual(datos(m, SUPV).reservas[0].cliente, 'Pérez Juan'); assert.strictEqual(reservar(m, SUPV).error, 'sin_permiso');
  assert.strictEqual(m.post({ token: 'x', action: 'radar_reservar' }).error, 'sesion_vencida');
});
T('retoques: supervisión tapa patentes/carteles; el asesor no; las cajas se acotan de 0 a 1', () => {
  const m = crear(personal);
  assert.strictEqual(m.radar(V1, { action: 'radar_retoque', foto: 'https://f/1.jpg', cajas: [[0.1, 0.2, 0.3, 0.1]] }).error, 'sin_permiso');
  const r = m.radar(JEF, { action: 'radar_retoque', foto: 'https://f/1.jpg', auto_id: 'maipu-1', cajas: [[0.1, 0.2, 0.3, 0.1], [-1, 2, 0.5, 0.5], [0.5, 0.5, 0, 0]] });
  assert(r.ok); assert.deepStrictEqual(JSON.parse(JSON.stringify(r.cajas)), [[0.1, 0.2, 0.3, 0.1], [0, 1, 0.5, 0.5]]);
  m.radar(JEF, { action: 'radar_retoque', foto: 'https://f/1.jpg', cajas: [[0.4, 0.4, 0.2, 0.1]] });
  const d = datos(m, V1); assert.deepStrictEqual(JSON.parse(JSON.stringify(d.retoques['https://f/1.jpg'])), [[0.4, 0.4, 0.2, 0.1]]); assert.strictEqual(m.libro.RadarRetoques.filas.length, 2, 'se reemplaza, no se duplica');
});
T('stock propio: lee la pestaña StockPropio con nombres de columna alternativos y omite los vendidos', () => {
  const m = crear(personal); m.libro.StockPropio = { nombre: 'StockPropio', filas: [['ID', 'Marca', 'Modelo', 'Año', 'Kilómetros', 'Precio venta', 'Fotos', 'Estado'],
    ['A1', 'Fiat', 'Cronos', 2022, '45.000', '$ 18.500.000', 'https://x/1.jpg | https://x/2.jpg', 'Disponible'], ['A2', 'VW', 'Gol', 2015, 120000, 6000000, '', 'Vendido']],
    getDataRange() { const s = this; return { getValues: () => s.filas.map(f => f.slice()) }; } };
  const p = datos(m, V1).propio; assert.strictEqual(p.length, 1);
  assert.deepStrictEqual({ id: p[0].id, anio: p[0].anio, km: p[0].km, precio: p[0].precio, fotos: p[0].fotos.length, propio: p[0].propio }, { id: 'propio-A1', anio: 2022, km: 45000, precio: 18500000, fotos: 2, propio: true });
});
T('lectura pública por GET (sin sesión) con los reservados', () => {
  const m = crear(personal); reservar(m, V1);
  const r = JSON.parse(m.api.doGet({ parameter: { action: 'radar_estado' } }).texto); assert(r.ok); assert.deepStrictEqual(r.reservados, ['maipu-1']); assert(!JSON.stringify(r).includes('Pérez'));
});
console.log(`\n${ok} bien, ${fail} con error`); if (fail) process.exit(1);
