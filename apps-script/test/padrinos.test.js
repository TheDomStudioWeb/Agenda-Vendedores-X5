// Pruebas de Padrinos X5 (node apps-script/test/padrinos.test.js)
const assert = require('assert'), { crear } = require('./mock');
const personal = [['Gerente Uno', 'Gerente Comercial', 'Activo', '', 'x', ''], ['Vendedor Carlos', 'Asesor', 'Activo', 'Gerente Uno', 'x', ''], ['Vendedora Dana', 'Asesor', 'Activo', 'Gerente Uno', 'x', ''], ['Sup Uno', 'Supervisor', 'Activo', '', 'x', ''], ['Ctrl Uno', 'Control', 'Activo', '', 'x', '']];
const GER = { nombre: 'Gerente Uno', rol: 'Gerente Comercial' }, V1 = { nombre: 'Vendedor Carlos', rol: 'Asesor' }, V2 = { nombre: 'Vendedora Dana', rol: 'Asesor' }, SUP = { nombre: 'Sup Uno', rol: 'Supervisor' }, CTL = { nombre: 'Ctrl Uno', rol: 'Control' };
let ok = 0, fail = 0;
const T = (n, f) => { try { f(); ok++; console.log('  ✓ ' + n); } catch (e) { fail++; console.log('  ✗ ' + n + '\n    ' + (e.stack || e).split('\n').slice(0, 9).join('\n    ')); } };
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
T('el CRM marca solo la entrevista y la firma del referido (por lead o por nombre), con sistema según el plan', () => {
  const m = m0(); const t = m.post({ action: 'login', nombre: 'Gerente Uno', clave: 'x' }).token;
  m.llamar(GER, { action: 'contratos_precios_cargar', modo: 'reemplazar', texto: 'PX64;VW Polo;10;250000;50000\nPX71;Vento;5;600000;100000' });
  const p = alta(m, GER, { nombre: 'Lucía', telefono: '2615551234', asesor: 'Vendedor Carlos' }).padrino;
  const r1 = m.pad(GER, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'Martín Ruiz', telefono: '2614440000' } });
  const r2 = m.pad(GER, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'Ana Sosa', telefono: '2614440001' } });
  const est = () => { const d = m.pad(GER, { action: 'padrinos_datos' }).referidos; return n => d.find(x => x.cliente === n); };
  // entrevista vinculada por lead_id
  assert(m.post({ token: t, action: 'add', tabla: 'Hoja 1', data: { id: 'A1', cliente: 'Martín Ruiz', asesor: 'Vendedor Carlos', fecha: '2026-11-18', hora: '10:00', estado: 'pendiente', lead_id: r1.lead_id } }).ok);
  assert.strictEqual(est()('Martín Ruiz').estado, 'camino');
  m.post({ token: t, action: 'update', tabla: 'Hoja 1', data: { id: 'A1', estado: 'realizado' } }); assert.strictEqual(est()('Martín Ruiz').estado, 'entrevista');
  m.post({ token: t, action: 'update', tabla: 'Hoja 1', data: { id: 'A1', resultado: 'venta', nro_contrato: '777', codigo_plan: 'PX71' } });
  let x = est()('Martín Ruiz'); assert(x.estado === 'firmo' && x.nro_contrato === '777' && x.sistema === '5 adelantos', JSON.stringify(x));
  m.post({ token: t, action: 'update', tabla: 'Hoja 1', data: { id: 'A1', estado: 'realizado', resultado: '' } }); assert.strictEqual(est()('Martín Ruiz').estado, 'firmo'); // no retrocede
  // por nombre (entrevista cargada sin vincular), venta directa
  m.post({ token: t, action: 'add', tabla: 'Hoja 1', data: { id: 'A2', cliente: 'sosa ana', asesor: 'Vendedor Carlos', fecha: '2026-11-18', hora: '11:00', estado: 'realizado', resultado: 'venta', nro_contrato: '778', codigo_plan: 'PX64' } });
  x = est()('Ana Sosa'); assert(x.estado === 'firmo' && x.sistema === '10 adelantos' && x.fecha_entrevista === '2026-11-18');
  // otro asesor con el mismo nombre no lo toca
  m.post({ token: t, action: 'add', tabla: 'Hoja 1', data: { id: 'A3', cliente: 'Martín Ruiz', asesor: 'Vendedora Dana', fecha: '2026-11-18', hora: '12:00', estado: 'realizado' } });
  assert(m.libro.PadrinosLog.filas.some(f => /desde el CRM/.test(f[3])));
});
T('eliminar padrino: solo gerente, borra sus referidos y canjes y deja copia en Eliminados', () => {
  const m = m0(); const p = alta(m, V1, { nombre: 'Prueba', telefono: '2615551234' }).padrino;
  m.pad(V1, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'Ref', telefono: '2614440000' } });
  assert.strictEqual(m.pad(V1, { action: 'padrinos_eliminar', id: p.id }).error, 'sin_permiso');
  const r = m.pad(GER, { action: 'padrinos_eliminar', id: p.id }); assert(r.ok && r.referidos === 1);
  const d = m.pad(GER, { action: 'padrinos_datos' }); assert.strictEqual(d.padrinos.length, 0); assert.strictEqual(d.referidos.length, 0);
  assert(m.libro.Eliminados.filas.length >= 3);
  assert.strictEqual(m.api.paseCliente_(p.codigo, p.llave).error, 'pase_invalido');
});
T('canjes: cerrados antes de la fecha; después el cliente pide, gerencia aprueba y entrega', () => {
  const m = m0(); const p = alta(m, GER, { nombre: 'Lucía', telefono: '2615551234', asesor: 'Vendedor Carlos' }).padrino;
  const pedir = () => m.post({ action: 'pase_canje', c: p.codigo, k: p.llave, premio_id: 'lavado', premio: 'Lavado completo', puntos: 80 });
  assert.strictEqual(pedir().error, 'canjes_no_habilitados');
  m.reloj('2027-02-20T10:00:00-03:00');
  assert(pedir().ok); assert(pedir().ok); assert(pedir().ok); assert.strictEqual(pedir().error, 'demasiados_pendientes');
  const d = m.pad(GER, { action: 'padrinos_datos' }); assert.strictEqual(d.canjes.length, 3); const id = d.canjes[0].id;
  assert.strictEqual(m.pad(JEF_OR_V1(), { action: 'padrinos_canje', id, estado: 'aprobado' }).error, 'sin_permiso');
  assert.strictEqual(m.pad(GER, { action: 'padrinos_canje', id, estado: 'entregado' }).error, 'orden_invalido');
  assert(m.pad(GER, { action: 'padrinos_canje', id, estado: 'aprobado' }).ok); assert(m.pad(GER, { action: 'padrinos_canje', id, estado: 'entregado' }).ok);
  const pase = m.api.paseCliente_(p.codigo, p.llave); assert.strictEqual(pase.canjes.length, 3); assert.strictEqual(pase.canjes_desde, '2027-02-18');
});
function JEF_OR_V1() { return V1; }
T('la tarjeta trae el teléfono del asesor (de Personal) si está activo', () => {
  const m = m0(); const P = m.libro.Personal; P.filas[0].push('telefono'); P.filas[2].push("'261 343-1216");
  const p = alta(m, V1, { nombre: 'Lucía Gómez', telefono: '2615551234' }).padrino;
  assert.strictEqual(m.api.paseCliente_(p.codigo, p.llave).padrino.asesor_tel, '2613431216');
  P.filas[2][2] = 'Inactivo'; assert.strictEqual(m.api.paseCliente_(p.codigo, p.llave).padrino.asesor_tel, '');
});
T('al pasar a inactivo, leads abiertos, entrevistas pendientes, padrinos y referidos van al jefe', () => {
  const m = m0(); const p = alta(m, V1, { nombre: 'Lucía', telefono: '2615551234' }).padrino;
  const ref = m.pad(V1, { action: 'referidos_guardar', data: { padrino_id: p.id, cliente: 'Martín', telefono: '2614440000' } }).referido;
  m.libro.Leads.filas = [['id', 'cliente', 'asignado_a', 'estado', 'resultado', 'notas', 'actualizado'],
    ['1', 'Abierto', 'Vendedor Carlos', 'pendiente', '', '', ''], ['2', 'Seguimiento', 'Vendedor Carlos', 'en_seguimiento', '', 'llamar', ''],
    ['3', 'Descartado', 'Vendedor Carlos', 'descartado', '', '', ''], ['4', 'De Dana', 'Vendedora Dana', 'pendiente', '', '', '']];
  m.libro['Hoja 1'].filas = [['id', 'cliente', 'asesor', 'estado', 'resultado', 'notas', 'actualizado'],
    ['a', 'Pendiente', 'Vendedor Carlos', 'pendiente', '', '', ''], ['b', 'Vendida', 'Vendedor Carlos', 'realizado', 'venta', '', ''], ['c', 'Seguir', 'Vendedor Carlos', 'realizado', 'seguimiento', '', '']];
  assert.strictEqual(m.api.reasignarInactivos_().leads, 0); // todos activos: no toca nada
  m.libro.Personal.filas[2][2] = 'Inactivo';
  const t = m.api.reasignarInactivos_();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(t)), { leads: 2, entrevistas: 2, padrinos: 1, referidos: 1 });
  const L = m.libro.Leads.filas, H = L[0], col = k => H.indexOf(k);
  assert.strictEqual(L[1][col('asignado_a')], 'Gerente Uno'); assert(/llamar \[[\d/-]+ reasignado: Vendedor Carlos quedó inactivo\]/.test(L[2][col('notas')]));
  assert.strictEqual(L[3][col('asignado_a')], 'Vendedor Carlos'); assert.strictEqual(L[4][col('asignado_a')], 'Vendedora Dana'); // descartado y leads de otros no se tocan
  const A = m.libro['Hoja 1'].filas, HA = A[0];
  assert.strictEqual(A[1][HA.indexOf('asesor')], 'Gerente Uno'); assert.strictEqual(A[2][HA.indexOf('asesor')], 'Vendedor Carlos'); assert.strictEqual(A[3][HA.indexOf('asesor')], 'Gerente Uno');
  const d = m.pad(GER, { action: 'padrinos_datos' }); assert.strictEqual(d.padrinos[0].asesor, 'Gerente Uno'); assert.strictEqual(d.referidos.find(r => r.id === ref.id).asesor, 'Gerente Uno');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(m.api.reasignarInactivos_())), { leads: 0, entrevistas: 0, padrinos: 0, referidos: 0 }); // no repite
});

console.log(`\n${ok} bien, ${fail} con error`); process.exit(fail ? 1 : 0);
