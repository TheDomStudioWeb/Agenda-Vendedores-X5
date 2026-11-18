/**
 * X5 Cuyo · Hub Comercial — Backend (Google Apps Script)
 * ------------------------------------------------------------------
 * Cambios respecto de la versión anterior:
 *  - Escribe y lee por NOMBRE DE ENCABEZADO, no por número de columna.
 *    Si falta una columna (ej. "notas" en Leads) la crea sola.
 *    => Corrige que las observaciones de los Leads se borraban.
 *  - Las claves del personal NUNCA salen del servidor.
 *  - Login validado en el servidor; devuelve un token firmado (30 días).
 *  - v2.2: lectura y escritura cerradas sin sesión (MODO_COMPATIBLE = false) y
 *    bloqueo de 10 minutos tras 5 claves incorrectas.
 *  - Cada usuario recibe solo la agenda y los leads que le corresponden.
 *  - Escrituras con LockService (evita filas pisadas si dos guardan a la vez).
 *  - Respuestas con { ok: true/false } para que la app sepa si se guardó.
 *
 *
 * v2.7: Padrinos X5, club de referidos (hojas «Padrinos», «Referidos» y «PadrinosLog»; el referido entra como lead).
 *
 * v2.6: registro de ingreso y egreso del personal (hoja «Asistencia», rol «Personal»).
 *
 * v2.4: claves protegidas en la planilla (huella con sal; protegerClaves() o primer ingreso) y sesión por POST, nunca en la dirección.
 *
 * v2.3: edición validada en el servidor (un asesor solo modifica lo propio), lista de
 *       usuarios sin puestos, caché corto del personal, renovación de la sesión mientras se usa
 *       y limpieza automática de la hoja «Eliminados» (copias de más de 90 días).
 *
 * v2.1: avisos por Telegram (lead asignado, lead vencido, venta cerrada)
 *       y resumen para el widget del launcher (?action=widget&key=...).
 *       Configuración en docs/AVISOS-Y-WIDGET.md
 *
 * Despliegue: Implementar > Administrar implementaciones > editar la
 * implementación actual > Versión: "Nueva versión". Así la URL /exec
 * no cambia y la app sigue apuntando al mismo lugar.
 */

// ── Configuración ──────────────────────────────────────────────────
const DIAS_TOKEN = 30;
const RENOVAR_TOKEN_DIAS = 15;  // si a la sesión le quedan menos días, se renueva sola
const DIAS_ELIMINADOS = 90;     // las copias de «Eliminados» se limpian pasado este plazo
const MAX_INTENTOS_LOGIN = 5;   // errores de clave permitidos por usuario
const MIN_BLOQUEO_LOGIN = 10;   // minutos de bloqueo tras superarlos
const ROLES_SUPERVISION = ['Gerente Comercial', 'Jefe de Ventas', 'Referente'];
const ROL_ARCHIVO = 'Gerente Comercial'; // único rol que archiva y restaura
const ROL_CONTROL = 'Control';           // solo lectura: ve todo el gestor de contratos y nada más
const ROL_SUPERVISOR = 'Supervisor';     // solo lectura en todo el Hub: ve el CRM completo y los contratos, no modifica nada

const HOJAS = {
  agenda: 'Hoja 1',
  leads: 'Leads',
  personal: 'Personal',
  flota: 'Flota'
};

// Columnas esperadas (se crean si faltan, en este orden al final de la hoja)
const COLUMNAS = {
  'Hoja 1': ['id', 'cliente', 'vehiculo', 'asesor', 'fecha', 'hora', 'estado', 'resultado', 'notas', 'lugar', 'auto_usado', 'nro_contrato', 'monto', 'actualizado', 'aviso_venta', 'codigo_plan', 'domicilio', 'lat', 'lng', 'lead_id'],
  'Leads': ['id', 'cliente', 'telefono', 'interes', 'origen', 'asignado_a', 'fecha_asignacion', 'hora_limite', 'estado', 'resultado', 'hora_contacto', 'notas', 'actualizado', 'aviso_vencido', 'aviso_seguimiento',
    // Calificación del Armador de Plan (se completan solo cuando el lead se guarda desde el Armador)
    'calif_sistema', 'calif_cuota', 'calif_capital', 'calif_urgencia', 'calif_usado', 'calif_0km',
    // Recordatorios enviados a un lead «Esperando horario» (0, 1 o 2)
    'recordatorios']
};

// Campos que se guardan como texto (con apóstrofo) para que Sheets no los convierta
const CAMPOS_TEXTO = ['telefono', 'fecha', 'hora', 'fecha_asignacion', 'hora_limite', 'hora_contacto', 'nro_contrato'];
// Campos que el cliente nunca puede pisar
const CAMPOS_PROTEGIDOS = ['id', 'actualizado', 'aviso_venta', 'aviso_vencido', 'aviso_seguimiento'];
// Campos con fecha y hora completas (el resto de las fechas se leen como día)
const CAMPOS_MARCA_TIEMPO = ['actualizado', 'aviso_venta', 'aviso_vencido', 'aviso_seguimiento'];
// Dirección pública del Hub (para los enlaces de los avisos y del widget)
const HUB_URL = 'https://thedomstudioweb.github.io/Agenda-Vendedores-X5/';

// ── Entradas HTTP ──────────────────────────────────────────────────
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'usuarios') return json_({ ok: true, usuarios: listarUsuarios_() });

    // Clave de solo lectura para widgets (Propiedades del script > LAUNCHER_KEY)
    const launcherKey = PropertiesService.getScriptProperties().getProperty('LAUNCHER_KEY');
    const conClave = !!(p.key && launcherKey && p.key === launcherKey);

    // Lectura por GET: solo el widget del launcher, con su clave de solo lectura.
    // La sesión (token) NUNCA viaja en la dirección: los datos y el enlace de Telegram se piden por POST.
    if (p.action === 'widget') {
      if (!conClave) return json_({ ok: false, error: 'sin_autorizacion' });
      return json_(resumenWidget_(null));
    }
    if (conClave) return json_(armarDatos_(null));
    return json_({ ok: false, error: 'sin_autorizacion' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');

    if (body.action === 'login') return json_(login_(body.nombre, body.clave));

    const usuario = body.token ? validarToken_(body.token) : null;
    if (!usuario) return json_({ ok: false, error: 'sesion_vencida' });

    // Rol «Personal» (cobra por horas): solo marca su ingreso y su salida
    if (esPersonal_(usuario) && String(body.action).indexOf('asistencia_') !== 0) return json_({ ok: false, error: 'sin_permiso' });
    // Rol «Control»: únicamente mira el gestor de contratos (ver todo, sin modificar nada ni entrar al CRM)
    if (esControl_(usuario) && ['contratos_datos', 'contratos_precios'].indexOf(String(body.action)) < 0) return json_({ ok: false, error: 'sin_permiso' });
    // Rol «Supervisor»: mira todo (CRM completo y contratos) y nada más. Solo se aceptan pedidos de lectura; cualquier otra acción se rechaza acá, antes de tocar la planilla
    if (esSupervisor_(usuario) && ['datos', 'contratos_datos', 'contratos_precios', 'asistencia_datos', 'padrinos_datos'].indexOf(String(body.action)) < 0) return json_({ ok: false, error: 'sin_permiso' });

    // Lectura de datos y enlace de Telegram (la sesión viaja en el cuerpo, no en la dirección)
    if (body.action === 'datos') { if (!usuario) return json_({ ok: false, error: 'sesion_vencida' }); return json_(armarDatos_(usuario)); }
    if (body.action === 'telegram_link') { if (!usuario) return json_({ ok: false, error: 'sesion_vencida' }); return json_(linkTelegram_(usuario.nombre)); }

    // Ingreso y egreso del personal (la hora la pone el servidor)
    if (String(body.action).indexOf('asistencia_') === 0) return json_(despacharAsistencia_(body, usuario));

    // Padrinos X5: club de referidos
    if (/^(padrinos|referidos)_/.test(String(body.action))) return json_(despacharPadrinos_(body, usuario));

    // Control de contratos (solo números y estados; no guarda archivos)
    if (String(body.action).indexOf('contratos_') === 0) return json_(despacharContratos_(body, usuario));

    // Archivo (solo Gerente Comercial): archivar descartados, ver el archivo y restaurar
    if (body.action === 'archivar' || body.action === 'archivo_listar' || body.action === 'restaurar') {
      if (!usuario) return json_({ ok: false, error: 'sesion_vencida' });
      if (usuario.rol !== ROL_ARCHIVO) return json_({ ok: false, error: 'sin_permiso' });
      const lk = LockService.getScriptLock();
      lk.waitLock(15000);
      try {
        if (body.action === 'archivar') return json_(archivarLote_(body.criterio || {}, usuario));
        if (body.action === 'restaurar') return json_(restaurarArchivo_(body.items || []));
        return json_(listarArchivo_());
      } finally { lk.releaseLock(); }
    }

    const nombreHoja = body.tabla || HOJAS.agenda;
    if (!COLUMNAS[nombreHoja]) return json_({ ok: false, error: 'tabla_invalida' });

    const avisos = []; // se envían después de liberar el lock, para no demorar el guardado
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sheet = obtenerHoja_(nombreHoja);
      const headers = asegurarColumnas_(sheet, COLUMNAS[nombreHoja]);
      const datos = body.data || {};

      if (body.action === 'add') {
        if (buscarFila_(sheet, datos.id) > 0) return json_({ ok: true, duplicado: true });
        // Un asesor solo puede cargar lo propio; asignarle a otro es de supervisión
        const colDuenio = nombreHoja === HOJAS.leads ? 'asignado_a' : 'asesor';
        if (!esSupervision_(usuario) && String(datos[colDuenio]) !== String(usuario.nombre)) return json_({ ok: false, error: 'sin_permiso' });
        const fila = headers.map(h => valorParaCelda_(h, h === 'actualizado' ? new Date() : datos[h]));
        sheet.appendRow(fila);
        if (nombreHoja === HOJAS.leads && String(datos.asignado_a) !== String(usuario.nombre)) avisos.push(() => avisarLeadAsignado_(datos, usuario)); // el lead propio no se avisa a uno mismo
        return json_({ ok: true });
      }

      if (body.action === 'update') {
        const filaN = buscarFila_(sheet, datos.id);
        if (filaN < 0) return json_({ ok: false, error: 'no_encontrado' });
        const rango = sheet.getRange(filaN, 1, 1, headers.length);
        const actual = rango.getValues()[0];
        // Un asesor solo edita lo propio y no puede pasárselo a otro
        if (!esSupervision_(usuario)) {
          const iDuenio = headers.indexOf(nombreHoja === HOJAS.leads ? 'asignado_a' : 'asesor');
          const nuevoDuenio = Object.prototype.hasOwnProperty.call(datos, headers[iDuenio]) ? datos[headers[iDuenio]] : actual[iDuenio];
          if (String(actual[iDuenio]) !== String(usuario.nombre) || String(nuevoDuenio) !== String(usuario.nombre)) return json_({ ok: false, error: 'sin_permiso' });
        }
        headers.forEach((h, i) => {
          if (CAMPOS_PROTEGIDOS.includes(h)) return;
          if (Object.prototype.hasOwnProperty.call(datos, h) && datos[h] !== undefined) {
            actual[i] = valorParaCelda_(h, datos[h]);
          }
        });
        const iAct = headers.indexOf('actualizado');
        if (iAct > -1) actual[iAct] = new Date();

        // Venta cerrada con monto cargado y todavía sin avisar → aviso inmediato
        if (nombreHoja === HOJAS.agenda) {
          const col = (h) => headers.indexOf(h);
          const esVenta = String(actual[col('resultado')]) === 'venta';
          const montoCargado = String(actual[col('monto')]) !== '';
          if (esVenta && montoCargado && !actual[col('aviso_venta')]) {
            actual[col('aviso_venta')] = new Date();
            const venta = {};
            headers.forEach((h, i) => venta[h] = actual[i]);
            avisos.push(() => avisarVenta_(venta));
          }
        }
        rango.setValues([actual]);
        return json_({ ok: true });
      }

      if (body.action === 'delete') return json_(eliminarRegistro_(sheet, headers, nombreHoja, datos, usuario));

      return json_({ ok: false, error: 'accion_invalida' });
    } finally {
      lock.releaseLock();
      avisos.forEach(fn => { try { fn(); } catch (e) { console.warn('Aviso no enviado: ' + e); } });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ── Eliminar (con copia de seguridad) ──────────────────────────────
// Solo quien tiene sesión. Puede eliminar el supervisor (gerente, jefe, referente)
// o el asesor dueño del registro. Antes de borrar, guarda una copia en la hoja "Eliminados".
function esSupervision_(usuario) { return ROLES_SUPERVISION.indexOf(usuario.rol) > -1; }

function eliminarRegistro_(sheet, headers, nombreHoja, datos, usuario) {
  if (!usuario) return { ok: false, error: 'sesion_vencida' };
  const filaN = buscarFila_(sheet, datos.id);
  if (filaN < 0) return { ok: true, ya_no_existe: true };
  const fila = sheet.getRange(filaN, 1, 1, headers.length).getValues()[0];
  const reg = {};
  headers.forEach((h, i) => { reg[h] = fila[i]; });
  const duenio = nombreHoja === HOJAS.leads ? reg.asignado_a : reg.asesor;
  if (!esSupervision_(usuario) && String(duenio) !== String(usuario.nombre)) {
    return { ok: false, error: 'sin_permiso' };
  }
  archivarEliminado_(nombreHoja, reg, usuario);
  sheet.deleteRow(filaN);
  return { ok: true };
}

function archivarEliminado_(nombreHoja, reg, usuario) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Eliminados');
  if (!h) {
    h = ss.insertSheet('Eliminados');
    h.appendRow(['fecha', 'tabla', 'id', 'cliente', 'eliminado_por', 'datos']);
  }
  h.appendRow([new Date(), nombreHoja, "'" + reg.id, reg.cliente || '', usuario.nombre, JSON.stringify(reg)]);
  limpiarEliminados_(h);
}

// Quita de «Eliminados» las copias de más de DIAS_ELIMINADOS días (las filas están en orden de fecha)
function limpiarEliminados_(h) {
  const n = h.getLastRow() - 1;
  if (n < 200) return; // con pocas filas no vale la pena
  const corte = Date.now() - DIAS_ELIMINADOS * 86400000;
  const fechas = h.getRange(2, 1, n, 1).getValues();
  let viejas = 0;
  while (viejas < n && fechas[viejas][0] instanceof Date && fechas[viejas][0].getTime() < corte) viejas++;
  if (viejas > 0) h.deleteRows(2, viejas);
}

// ── Archivo de descartados (con restauración) ─────────────────────
// Mueve a la hoja "Archivo" los leads descartados y las entrevistas con resultado
// "descartado" (y, si se pide, las canceladas). No borra nada: se puede restaurar.
// criterio = { leads: bool, entrevistas: bool, canceladas: bool, dias: número (0 = todos) }
function hojaArchivo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Archivo');
  if (!h) {
    h = ss.insertSheet('Archivo');
    h.appendRow(['fecha', 'tabla', 'id', 'cliente', 'archivado_por', 'datos']);
  }
  return h;
}

function diaTxt_(v, tz) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  return String(v == null ? '' : v).replace(/^'/, '').split('T')[0];
}

function archivarLote_(c, usuario) {
  const tz = Session.getScriptTimeZone();
  const dias = Math.max(0, Number(c.dias) || 0);
  const corte = dias > 0 ? Utilities.formatDate(new Date(Date.now() - dias * 86400000), tz, 'yyyy-MM-dd') : '';
  const res = { ok: true, leads: 0, entrevistas: 0 };
  const tablas = [];
  if (c.leads) tablas.push(HOJAS.leads);
  if (c.entrevistas) tablas.push(HOJAS.agenda);
  if (!tablas.length) return res;
  const filasArchivo = [];
  const ahora = new Date();
  tablas.forEach(nombre => {
    const sheet = obtenerHoja_(nombre);
    const headers = asegurarColumnas_(sheet, COLUMNAS[nombre]);
    const n = sheet.getLastRow() - 1;
    if (n < 1) return;
    const vals = sheet.getRange(2, 1, n, headers.length).getValues();
    const esLead = nombre === HOJAS.leads;
    const borrar = [];
    vals.forEach((fila, i) => {
      const r = {};
      headers.forEach((h, k) => { r[h] = normalizar_(fila[k], tz, h); });
      const descartado = esLead
        ? String(r.estado) === 'descartado'
        : (String(r.resultado) === 'descartado' || (c.canceladas && String(r.estado) === 'cancelado'));
      if (!descartado) return;
      if (corte) {
        const f = diaTxt_(esLead ? r.fecha_asignacion : r.fecha, tz);
        if (!f || f >= corte) return;
      }
      filasArchivo.push([ahora, nombre, "'" + r.id, r.cliente || '', usuario.nombre, JSON.stringify(r)]);
      borrar.push(i + 2);
      if (esLead) res.leads++; else res.entrevistas++;
    });
    borrar.reverse().forEach(f => sheet.deleteRow(f));
  });
  if (filasArchivo.length) {
    const h = hojaArchivo_();
    h.getRange(h.getLastRow() + 1, 1, filasArchivo.length, 6).setValues(filasArchivo);
  }
  return res;
}

function listarArchivo_() {
  const tz = Session.getScriptTimeZone();
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Archivo');
  if (!h || h.getLastRow() < 2) return { ok: true, items: [] };
  const vals = h.getRange(2, 1, h.getLastRow() - 1, 6).getValues();
  const items = vals.map(v => {
    let d = {};
    try { d = JSON.parse(v[5]); } catch (e) {}
    const esLead = v[1] === HOJAS.leads;
    return {
      tabla: v[1], id: String(v[2]).replace(/^'/, ''), cliente: v[3], por: v[4],
      archivado: Object.prototype.toString.call(v[0]) === '[object Date]' ? Utilities.formatDate(v[0], tz, 'yyyy-MM-dd') : String(v[0]),
      fecha: diaTxt_(esLead ? d.fecha_asignacion : d.fecha, tz),
      detalle: esLead ? [d.interes, d.asignado_a].filter(Boolean).join(' · ') : [d.vehiculo, d.asesor].filter(Boolean).join(' · '),
      estado: esLead ? d.estado : (d.resultado || d.estado)
    };
  }).reverse().slice(0, 300);
  return { ok: true, items: items };
}

// items = [{ tabla, id }]
function restaurarArchivo_(items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('Archivo');
  if (!h || h.getLastRow() < 2) return { ok: true, restaurados: 0 };
  let restaurados = 0;
  items.slice(0, 100).forEach(it => {
    if (!COLUMNAS[it.tabla]) return;
    const n = h.getLastRow() - 1;
    if (n < 1) return;
    const vals = h.getRange(2, 1, n, 6).getValues();
    let fila = -1;
    for (let i = vals.length - 1; i >= 0; i--) {
      if (vals[i][1] === it.tabla && String(vals[i][2]).replace(/^'/, '') === String(it.id)) { fila = i + 2; break; }
    }
    if (fila < 0) return;
    let d;
    try { d = JSON.parse(vals[fila - 2][5]); } catch (e) { return; }
    const sheet = obtenerHoja_(it.tabla);
    const headers = asegurarColumnas_(sheet, COLUMNAS[it.tabla]);
    if (buscarFila_(sheet, d.id) < 0) {
      sheet.appendRow(headers.map(c => valorParaCelda_(c, c === 'actualizado' ? new Date() : d[c])));
    }
    h.deleteRow(fila);
    restaurados++;
  });
  return { ok: true, restaurados: restaurados };
}

// ── Login y tokens ────────────────────────────────────────────────
function iguales_(a, b) { // comparación sin cortar en la primera diferencia
  a = String(a); b = String(b);
  let r = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}

// ── Claves protegidas ─────────────────────────────────────────────
// En la hoja Personal la clave puede estar escrita normal (ej. 4821) o protegida ("h1$sal$huella").
// Al ingresar con una clave escrita normal, se reemplaza sola por su versión protegida.
// Para cambiar o dar una clave nueva: escribirla normal en la celda; se protege en el primer ingreso
// (o al ejecutar protegerClaves()).
const HASH_VUELTAS = 1000;

function esHashClave_(v) { return /^h1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(String(v)); }

function huellaClave_(sal, clave) {
  let h = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(clave), sal)).replace(/=+$/, '');
  for (let i = 0; i < HASH_VUELTAS; i++) h = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(h + String(clave), sal)).replace(/=+$/, '');
  return h;
}

function hashClave_(clave) {
  const sal = Utilities.getUuid().replace(/-/g, '');
  return 'h1$' + sal + '$' + huellaClave_(sal, clave);
}

function claveCorrecta_(guardada, ingresada) {
  if (esHashClave_(guardada)) {
    const partes = String(guardada).split('$');
    return iguales_(partes[2], huellaClave_(partes[1], ingresada));
  }
  return iguales_(guardada, ingresada);
}

function guardarClave_(nombre, valor) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = obtenerHoja_(HOJAS.personal);
    const datos = sheet.getDataRange().getValues();
    const headers = datos[0].map(h => String(h).trim().toLowerCase());
    const iN = headers.indexOf('nombre'), iC = headers.indexOf('clave');
    if (iN < 0 || iC < 0) return;
    for (let i = 1; i < datos.length; i++) {
      if (mismoNombre_(datos[i][iN], nombre)) { sheet.getRange(i + 1, iC + 1).setValue(valor); return; }
    }
  } finally { lock.releaseLock(); }
}

// Ejecutar UNA VEZ desde Apps Script para proteger todas las claves de golpe
function protegerClaves() {
  const sheet = obtenerHoja_(HOJAS.personal);
  const datos = sheet.getDataRange().getValues();
  const headers = datos[0].map(h => String(h).trim().toLowerCase());
  const iC = headers.indexOf('clave');
  if (iC < 0) throw new Error('No hay columna «clave» en Personal');
  let n = 0;
  for (let i = 1; i < datos.length; i++) {
    const v = datos[i][iC];
    if (v === '' || v === null || esHashClave_(v)) continue;
    sheet.getRange(i + 1, iC + 1).setValue(hashClave_(v));
    n++;
  }
  console.log('Claves protegidas: ' + n);
}

function login_(nombre, clave) {
  const cache = CacheService.getScriptCache();
  const kInt = 'intentos_' + Utilities.base64EncodeWebSafe(String(nombre)).slice(0, 80);
  const intentos = Number(cache.get(kInt) || 0);
  if (intentos >= MAX_INTENTOS_LOGIN) return { ok: false, error: 'demasiados_intentos' };
  const persona = leerHoja_(HOJAS.personal).find(p => String(p.nombre) === String(nombre));
  if (!persona || String(persona.estado) !== 'Activo') return { ok: false, error: 'usuario_invalido' };
  if (!claveCorrecta_(persona.clave, clave)) {
    cache.put(kInt, String(intentos + 1), MIN_BLOQUEO_LOGIN * 60);
    return { ok: false, error: 'clave_incorrecta' };
  }
  cache.remove(kInt);
  if (!esHashClave_(persona.clave)) { try { guardarClave_(persona.nombre, hashClave_(clave)); } catch (e) { console.warn('No se pudo proteger la clave: ' + e); } }
  const exp = Date.now() + DIAS_TOKEN * 86400000;
  return { ok: true, token: firmarToken_(persona.nombre, exp), usuario: limpiarPersona_(persona) };
}

var EXP_TOKEN_ = 0; // vencimiento de la sesión validada en este pedido

// Personal sin claves, con caché de 60 segundos (evita releer la hoja en cada pedido)
function personalLimpio_() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('personal_limpio');
  if (guardado) { try { return JSON.parse(guardado); } catch (e) {} }
  const lista = leerHoja_(HOJAS.personal).map(limpiarPersona_);
  try { const t = JSON.stringify(lista); if (t.length < 90000) cache.put('personal_limpio', t, 60); } catch (e) {}
  return lista;
}

function firmarToken_(nombre, exp) {
  const payload = Utilities.base64EncodeWebSafe(Utilities.newBlob(nombre + '|' + exp).getBytes());
  return payload + '.' + firma_(payload);
}

function validarToken_(token) {
  const partes = String(token).split('.');
  if (partes.length !== 2 || firma_(partes[0]) !== partes[1]) return null;
  const texto = Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString();
  const corte = texto.lastIndexOf('|');
  const nombre = texto.slice(0, corte);
  const exp = Number(texto.slice(corte + 1));
  if (!exp || Date.now() > exp) return null;
  const persona = personalLimpio_().find(p => String(p.nombre) === nombre);
  if (!persona || String(persona.estado) !== 'Activo') return null; // baja = sesión cortada
  EXP_TOKEN_ = exp;
  return persona;
}

function firma_(texto) {
  const props = PropertiesService.getScriptProperties();
  let secreto = props.getProperty('TOKEN_SECRET');
  if (!secreto) {
    secreto = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('TOKEN_SECRET', secreto);
  }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, secreto)).replace(/=+$/, '');
}

// ── Armado de datos según quién pide ─────────────────────────────
function armarDatos_(usuario) {
  const personal = personalLimpio_().filter(p => p.rol !== 'Personal'); // el personal por horas no vende ni recibe leads
  let agenda = leerHoja_(HOJAS.agenda);
  let leads = leerHoja_(HOJAS.leads);
  const flota = leerHoja_(HOJAS.flota);

  if (usuario) {
    const puedeVer = visibilidad_(usuario, personal);
    agenda = agenda.filter(a => puedeVer(a.asesor));
    leads = leads.filter(l => puedeVer(l.asignado_a));
  }
  const out = { ok: true, agenda: agenda, leads: leads, personal: personal, flota: flota, usuario: usuario || undefined, servidor: new Date().toISOString() };
  // Sesión que se renueva mientras se usa: si le quedan pocos días, se entrega un token nuevo
  if (usuario && EXP_TOKEN_ && EXP_TOKEN_ - Date.now() < RENOVAR_TOKEN_DIAS * 86400000) {
    out.token_nuevo = firmarToken_(usuario.nombre, Date.now() + DIAS_TOKEN * 86400000);
  }
  return out;
}

function visibilidad_(usuario, personal) {
  if (usuario.rol === 'Gerente Comercial' || esSupervisor_(usuario)) return () => true;
  const equipo = personal.filter(p => p.reporta_a === usuario.nombre).map(p => p.nombre);
  return nombre => nombre === usuario.nombre || equipo.includes(nombre);
}

function listarUsuarios_() {
  // Solo los nombres: el puesto es privado y se conoce recién al iniciar sesión
  return personalLimpio_()
    .filter(p => String(p.estado) === 'Activo')
    .map(p => ({ nombre: p.nombre }));
}

function limpiarPersona_(p) {
  const copia = Object.assign({}, p);
  delete copia.clave;
  delete copia.telegram;
  return copia;
}

// ── Utilidades de hoja ────────────────────────────────────────────
function obtenerHoja_(nombre) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!sheet) throw new Error('No existe la hoja ' + nombre);
  return sheet;
}

function leerHoja_(nombre) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data.shift().map(h => String(h).trim().toLowerCase());
  const tz = Session.getScriptTimeZone();
  const filas = data
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = normalizar_(row[i], tz, h); });
      return obj;
    });
  return nombre === HOJAS.personal ? filas.map(personaNormalizada_) : filas;
}

// Personal: tolera espacios de más y mayúsculas al cargar a mano ("activo", "Activo ", " Juan Pérez")
function personaNormalizada_(p) {
  ['nombre', 'rol', 'reporta_a', 'estado'].forEach(k => { if (typeof p[k] === 'string') p[k] = p[k].replace(/\s+/g, ' ').trim(); });
  if (/^activ[oa]$/i.test(p.estado || '')) p.estado = 'Activo';
  return p;
}
const mismoNombre_ = (a, b) => String(a).replace(/\s+/g, ' ').trim() === String(b).replace(/\s+/g, ' ').trim();
const esActivo_ = (v) => /^activ[oa]$/i.test(String(v).trim());

// Ejecutar desde Apps Script: lista quién de Personal NO aparece en el Hub y por qué
function revisarPersonal() {
  const sheet = obtenerHoja_(HOJAS.personal);
  const datos = sheet.getDataRange().getValues();
  const h = datos[0].map(x => String(x).trim().toLowerCase());
  const iN = h.indexOf('nombre'), iE = h.indexOf('estado');
  const vistos = {}, problemas = [];
  for (let r = 1; r < datos.length; r++) {
    const fila = datos[r];
    if (!fila.some(c => c !== '' && c !== null)) continue;
    const nom = String(fila[iN] || '').replace(/\s+/g, ' ').trim(), est = String(fila[iE] || '').trim();
    if (!nom) problemas.push(`Fila ${r + 1}: sin nombre en la columna «nombre»`);
    else if (!esActivo_(est)) problemas.push(`Fila ${r + 1} (${nom}): estado «${est || 'vacío'}» — tiene que decir Activo`);
    if (nom && vistos[nom.toLowerCase()]) problemas.push(`Fila ${r + 1} (${nom}): nombre repetido con la fila ${vistos[nom.toLowerCase()]} — se muestra una sola vez`);
    if (nom) vistos[nom.toLowerCase()] = r + 1;
  }
  console.log(problemas.length ? problemas.join('\n') : 'Todo bien: todas las filas de Personal aparecen en el Hub.');
  return problemas;
}

// Fechas y horas de Sheets → texto estable ("2026-10-13", "14:30")
function normalizar_(v, tz, campo) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (CAMPOS_MARCA_TIEMPO.includes(campo)) return v.toISOString();
    if (v.getFullYear() < 1901) return Utilities.formatDate(v, tz, 'HH:mm');
    return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  return v;
}

function asegurarColumnas_(sheet, esperadas) {
  const ultimaCol = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, ultimaCol).getValues()[0].map(h => String(h).trim().toLowerCase());
  if (headers.length === 1 && headers[0] === '') headers = [];
  const faltantes = esperadas.filter(c => !headers.includes(c));
  if (faltantes.length) {
    sheet.getRange(1, headers.length + 1, 1, faltantes.length).setValues([faltantes]);
    headers = headers.concat(faltantes);
  }
  return headers;
}

function buscarFila_(sheet, id) {
  if (id === undefined || id === null || id === '') return -1;
  const n = sheet.getLastRow() - 1;
  if (n < 1) return -1;
  const ids = sheet.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function valorParaCelda_(campo, valor) {
  if (valor === undefined || valor === null) return '';
  if (valor instanceof Date) return valor;
  let v = String(valor);
  // Evita que un texto que empieza con = + - @ se interprete como fórmula
  if (/^[=+\-@]/.test(v) && campo !== 'monto') v = "'" + v;
  if (CAMPOS_TEXTO.includes(campo) && v !== '' && v[0] !== "'") v = "'" + v;
  if (campo === 'monto' && v !== '') {
    const num = /^-?\d+(\.\d+)?$/.test(v)
      ? Number(v)                                                              // 2500000.5
      : Number(v.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')); // 2.500.000,5
    return isNaN(num) ? v : num;
  }
  return v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// =====================================================================
//  AVISOS POR TELEGRAM
//  Configuración (una sola vez): ver docs/AVISOS-Y-WIDGET.md
//   1. Crear el bot con @BotFather y copiar el token.
//   2. Propiedades del script → TELEGRAM_TOKEN = <token>
//   3. Ejecutar configurarTelegram() desde el editor.
// =====================================================================

const MINUTOS_REVISION_VENCIDOS = 10;   // cada cuánto se revisan los leads vencidos
const DIAS_SEGUIMIENTO = 15;            // leads «En seguimiento» con más de estos días de antigüedad
const DIAS_RECORDATORIO_SEGUIMIENTO = 3; // cada cuánto se repite la consulta si el lead sigue sin movimiento
const MINUTOS_GRACIA_VENTA = 30;        // si una venta queda sin monto, se avisa igual pasado este tiempo

/** Ejecutar UNA vez desde el editor después de guardar TELEGRAM_TOKEN. */
function configurarTelegram() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TELEGRAM_TOKEN')) throw new Error('Falta la propiedad TELEGRAM_TOKEN (Configuración del proyecto → Propiedades del script).');
  const me = tg_('getMe', {});
  if (!me || !me.ok) throw new Error('El token de Telegram no es válido: ' + JSON.stringify(me));
  props.setProperty('TELEGRAM_BOT', me.result.username);
  tg_('deleteWebhook', {});

  asegurarColumnas_(obtenerHoja_(HOJAS.personal), ['telegram']);
  asegurarColumnas_(obtenerHoja_(HOJAS.leads), COLUMNAS[HOJAS.leads]);
  asegurarColumnas_(obtenerHoja_(HOJAS.agenda), COLUMNAS[HOJAS.agenda]);

  marcarHistorialComoAvisado_(); // evita una lluvia de avisos de ventas y vencidos viejos

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'revisarTelegram')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('revisarTelegram').timeBased().everyMinutes(1).create();

  if (!props.getProperty('LAUNCHER_KEY')) props.setProperty('LAUNCHER_KEY', Utilities.getUuid().replace(/-/g, ''));
  console.log('✅ Telegram listo. Bot: @' + me.result.username);
  console.log('🔑 LAUNCHER_KEY para el widget: ' + props.getProperty('LAUNCHER_KEY'));
}

/** Marca como ya avisadas las ventas y los leads vencidos que existen hoy. */
function marcarHistorialComoAvisado_() {
  const ahora = new Date();
  [[HOJAS.agenda, 'aviso_venta', r => String(r.resultado) === 'venta'],
   [HOJAS.leads, 'aviso_vencido', r => String(r.estado) === 'pendiente']].forEach(([hoja, campo, cond]) => {
    const sheet = obtenerHoja_(hoja);
    const headers = asegurarColumnas_(sheet, COLUMNAS[hoja]);
    const data = sheet.getDataRange().getValues();
    const iC = headers.indexOf(campo);
    for (let r = 1; r < data.length; r++) {
      const fila = {}; headers.forEach((h, i) => fila[h] = data[r][i]);
      if (!fila[campo] && cond(fila) && (hoja === HOJAS.agenda || fechaHora_(fila.fecha_asignacion, fila.hora_limite, Session.getScriptTimeZone()) < ahora)) {
        sheet.getRange(r + 1, iC + 1).setValue(ahora);
      }
    }
  });
}

/** Envía un mensaje de prueba a los Gerentes Comerciales vinculados. */
function probarTelegram() {
  const n = enviarA_(gerentes_(), '✅ Prueba de avisos del Hub X5 Cuyo. Si ves esto, todo funciona.');
  console.log(n ? `Enviado a ${n} persona(s).` : 'Nadie vinculado todavía: entrá al CRM → botón 🔔 → abrir Telegram → Iniciar.');
}

/** Disparador cada 1 minuto: vincula usuarios nuevos y revisa vencidos / ventas pendientes de aviso. */
function revisarTelegram() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    procesarMensajesBot_();
    const props = PropertiesService.getScriptProperties();
    const ultima = Number(props.getProperty('ULTIMA_REVISION') || 0);
    if (Date.now() - ultima >= MINUTOS_REVISION_VENCIDOS * 60000) {
      props.setProperty('ULTIMA_REVISION', String(Date.now()));
      revisarLeadsVencidos_();
      revisarVentasSinAviso_();
      revisarSeguimientosViejos_();
    }
  } catch (e) {
    console.warn('revisarTelegram: ' + e);
  } finally {
    lock.releaseLock();
  }
}

// ── Vinculación: el usuario abre t.me/<bot>?start=<código> desde el CRM ──
function linkTelegram_(nombre) {
  const bot = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT');
  if (!bot) return { ok: false, error: 'telegram_no_configurado' };
  const payload = Utilities.base64EncodeWebSafe(Utilities.newBlob(nombre).getBytes()).replace(/=+$/, '');
  const codigo = payload + '_' + firma_('tg:' + payload).slice(0, 10);
  if (codigo.length > 64) return { ok: false, error: 'nombre_muy_largo' }; // límite de Telegram
  return { ok: true, url: `https://t.me/${bot}?start=${codigo}`, vinculado: !!chatDe_(nombre) };
}

function procesarMensajesBot_() {
  const props = PropertiesService.getScriptProperties();
  const offset = Number(props.getProperty('TG_OFFSET') || 0);
  const r = tg_('getUpdates', { offset: offset, timeout: 0, allowed_updates: ['message'] });
  if (!r || !r.ok || !r.result.length) return;
  r.result.forEach(u => {
    props.setProperty('TG_OFFSET', String(u.update_id + 1));
    const m = u.message; if (!m || !m.text) return;
    const chat = m.chat.id, texto = String(m.text).trim();
    const match = texto.match(/^\/start\s+([\w-]+)_([\w-]{10})$/);
    if (match) {
      const payload = match[1];
      if (firma_('tg:' + payload).slice(0, 10) !== match[2]) return tg_('sendMessage', { chat_id: chat, text: '⚠️ Enlace inválido. Abrilo de nuevo desde el CRM.' });
      const nombre = Utilities.newBlob(Utilities.base64DecodeWebSafe(payload + '==='.slice((payload.length + 3) % 4))).getDataAsString();
      if (guardarChat_(nombre, chat)) {
        tg_('sendMessage', { chat_id: chat, parse_mode: 'HTML', text: `✅ Listo, <b>${esc_(nombre.split(' ')[0])}</b>. Desde ahora vas a recibir acá los avisos del Hub X5 Cuyo.` });
      } else {
        tg_('sendMessage', { chat_id: chat, text: '⚠️ No encontré tu usuario activo en el Hub.' });
      }
    } else if (/^\/(start|ayuda|help)/i.test(texto)) {
      tg_('sendMessage', { chat_id: chat, text: 'Para activar los avisos entrá al Mini CRM del Hub X5 Cuyo y tocá el botón 🔔.' });
    }
  });
}

function guardarChat_(nombre, chatId) {
  const sheet = obtenerHoja_(HOJAS.personal);
  const headers = asegurarColumnas_(sheet, ['telegram']);
  const data = sheet.getDataRange().getValues();
  const iN = headers.indexOf('nombre'), iT = headers.indexOf('telegram'), iE = headers.indexOf('estado');
  for (let r = 1; r < data.length; r++) {
    if (mismoNombre_(data[r][iN], nombre) && esActivo_(data[r][iE])) {
      sheet.getRange(r + 1, iT + 1).setValue("'" + chatId);
      return true;
    }
  }
  return false;
}

// ── Destinatarios ────────────────────────────────────────────────
function personalCompleto_() { return leerHoja_(HOJAS.personal).filter(p => String(p.estado) === 'Activo'); }
function chatDe_(nombre) { const p = personalCompleto_().find(x => x.nombre === nombre); return p && p.telegram ? String(p.telegram).replace(/^'/, '') : null; }
function gerentes_() { return personalCompleto_().filter(p => p.rol === 'Gerente Comercial').map(p => p.nombre); }
function supervisoresDe_(nombre) {
  const todos = personalCompleto_();
  const yo = todos.find(p => p.nombre === nombre);
  const lista = new Set(gerentes_());
  if (yo && yo.reporta_a) lista.add(yo.reporta_a);
  lista.delete(nombre);
  return Array.from(lista);
}

/** Envía a una lista de nombres (sin repetir). Devuelve cuántos mensajes salieron. */
function enviarA_(nombres, html, botonUrl, botonTexto) {
  const hechos = new Set(); let n = 0;
  nombres.forEach(nombre => {
    const chat = chatDe_(nombre);
    if (!chat || hechos.has(chat)) return;
    hechos.add(chat);
    const payload = { chat_id: chat, text: html, parse_mode: 'HTML', disable_web_page_preview: true };
    if (botonUrl) payload.reply_markup = { inline_keyboard: [[{ text: botonTexto || 'Abrir en el Hub', url: botonUrl }]] };
    const r = tg_('sendMessage', payload);
    if (r && r.ok) n++;
  });
  return n;
}

// ── Avisos ───────────────────────────────────────────────────────
function avisarLeadAsignado_(lead, quienAsigna) {
  const lim = [String(lead.hora_limite || '').replace(/^'/, ''), fechaCorta_(lead.fecha_asignacion)].filter(Boolean).join(' · ');
  const html = `🎯 <b>Nuevo lead asignado</b>\n\n<b>${esc_(lead.cliente)}</b>\n📞 ${esc_(lead.telefono)}\n🚗 ${esc_(lead.interes)} · ${esc_(lead.origen)}` +
    (lim ? `\n⏰ Contactar antes de: <b>${esc_(lim)}</b>` : '') +
    (lead.notas ? `\n📝 ${esc_(lead.notas)}` : '') +
    (quienAsigna ? `\n\n<i>Asignado por ${esc_(quienAsigna.nombre)}</i>` : '');
  enviarA_([lead.asignado_a], html, HUB_URL + 'crm.html?tab=leads', 'Abrir mis leads');
}

function avisarVenta_(v) {
  const monto = v.monto !== '' && v.monto != null ? '\n💰 <b>' + esc_(moneda_(v.monto)) + '</b>' : '';
  const html = `🎉 <b>¡Venta cerrada!</b>\n\n👤 ${esc_(v.asesor)}\n🤝 ${esc_(v.cliente)} · ${esc_(v.vehiculo)}` + monto +
    (v.nro_contrato ? `\n📄 Contrato ${esc_(String(v.nro_contrato).replace(/^'/, ''))}` : '');
  enviarA_(supervisoresDe_(v.asesor), html, HUB_URL + 'crm.html?tab=dashboard', 'Ver métricas');
}

function revisarLeadsVencidos_() {
  const sheet = obtenerHoja_(HOJAS.leads);
  const headers = asegurarColumnas_(sheet, COLUMNAS[HOJAS.leads]);
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone(), ahora = new Date();
  const c = (h) => headers.indexOf(h);
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (String(row[c('estado')]) !== 'pendiente' || row[c('aviso_vencido')] || !row[c('hora_limite')]) continue; // sin hora límite = lead propio
    const limite = fechaHora_(row[c('fecha_asignacion')], row[c('hora_limite')], tz);
    if (!limite || limite > ahora) continue;
    const lead = {}; headers.forEach((h, i) => lead[h] = normalizar_(row[i], tz, h));
    const atraso = Math.round((ahora - limite) / 60000);
    const txtAtraso = atraso < 60 ? `${atraso} min` : `${Math.floor(atraso / 60)} h ${atraso % 60} min`;
    const base = `⚠️ <b>Lead vencido sin contactar</b>\n\n<b>${esc_(lead.cliente)}</b> · ${esc_(lead.interes)}\n📞 ${esc_(lead.telefono)}\n⏰ Venció hace ${txtAtraso}`;
    enviarA_([lead.asignado_a], base + '\n\nContactalo cuanto antes 💪', HUB_URL + 'crm.html?tab=leads&ver=vencidos', 'Ver vencidos');
    enviarA_(supervisoresDe_(lead.asignado_a), base + `\n👤 Asignado a <b>${esc_(lead.asignado_a)}</b>`, HUB_URL + 'crm.html?tab=leads&ver=vencidos', 'Ver vencidos');
    sheet.getRange(r + 1, c('aviso_vencido') + 1).setValue(new Date());
  }
}

/**
 * Leads «En seguimiento» con más de DIAS_SEGUIMIENTO días desde que se asignaron:
 *  - sin observaciones → pasan solos a «descartado» (sin preguntar);
 *  - con observaciones → se le pregunta al asesor por Telegram cómo está el seguimiento. Si no hay
 *    movimiento, lo pasa él a descartado en el momento. Si el lead sigue sin tocarse, se repite la consulta cada DIAS_RECORDATORIO_SEGUIMIENTO días.
 */
function revisarSeguimientosViejos_() {
  const sheet = obtenerHoja_(HOJAS.leads);
  const headers = asegurarColumnas_(sheet, COLUMNAS[HOJAS.leads]);
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone(), ahora = new Date(), DIA = 86400000;
  const c = (h) => headers.indexOf(h);
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (String(row[c('estado')]) !== 'en_seguimiento') continue;
    const desde = fechaHora_(row[c('fecha_asignacion')], '00:00', tz);
    if (!desde || (ahora - desde) <= DIAS_SEGUIMIENTO * DIA) continue;
    const notas = String(row[c('notas')] == null ? '' : row[c('notas')]).trim();
    if (!notas) {
      sheet.getRange(r + 1, c('estado') + 1).setValue('descartado');
      sheet.getRange(r + 1, c('actualizado') + 1).setValue(ahora);
      continue;
    }
    const aviso = row[c('aviso_seguimiento')] ? new Date(row[c('aviso_seguimiento')]) : null;
    const act = row[c('actualizado')] ? new Date(row[c('actualizado')]) : null;
    const sinMovimiento = !act || !aviso || act <= aviso;          // nadie lo tocó desde el último aviso
    if (aviso && (!sinMovimiento || (ahora - aviso) < DIAS_RECORDATORIO_SEGUIMIENTO * DIA)) continue;
    const lead = {}; headers.forEach((h, i) => lead[h] = normalizar_(row[i], tz, h));
    const dias = Math.floor((ahora - desde) / DIA);
    const html = `🔎 <b>¿Cómo sigue este lead?</b>\n\n<b>${esc_(lead.cliente)}</b> · ${esc_(lead.interes)}\n📞 ${esc_(lead.telefono)}\n📅 En seguimiento hace ${dias} días\n📝 ${esc_(notas.slice(0, 300))}` +
      `\n\nConfirmá en qué estado está. Si no tiene ningún movimiento, pasalo a <b>Descartado</b> ahora mismo.`;
    if (enviarA_([lead.asignado_a], html, HUB_URL + 'crm.html?tab=leads', 'Abrir mis leads') > 0)
      sheet.getRange(r + 1, c('aviso_seguimiento') + 1).setValue(ahora);
  }
}

/** Ventas marcadas sin monto: pasado el tiempo de gracia se avisan igual. */
function revisarVentasSinAviso_() {
  const sheet = obtenerHoja_(HOJAS.agenda);
  const headers = asegurarColumnas_(sheet, COLUMNAS[HOJAS.agenda]);
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone(), c = (h) => headers.indexOf(h);
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (String(row[c('resultado')]) !== 'venta' || row[c('aviso_venta')]) continue;
    const act = row[c('actualizado')];
    if (!(act instanceof Date)) { sheet.getRange(r + 1, c('aviso_venta') + 1).setValue(new Date()); continue; } // ventas viejas: no avisar
    if (Date.now() - act.getTime() < MINUTOS_GRACIA_VENTA * 60000) continue;
    const v = {}; headers.forEach((h, i) => v[h] = normalizar_(row[i], tz, h));
    avisarVenta_(v);
    sheet.getRange(r + 1, c('aviso_venta') + 1).setValue(new Date());
  }
}

// =====================================================================
//  WIDGET DEL LAUNCHER — GET ?action=widget&key=<LAUNCHER_KEY>
// =====================================================================
function resumenWidget_(usuario) {
  const tz = Session.getScriptTimeZone(), ahora = new Date();
  const hoy = Utilities.formatDate(ahora, tz, 'yyyy-MM-dd'), mes = hoy.slice(0, 7);
  const personal = leerHoja_(HOJAS.personal).map(limpiarPersona_);
  const ver = usuario ? visibilidad_(usuario, personal) : () => true;
  const agenda = leerHoja_(HOJAS.agenda).filter(a => ver(a.asesor));
  const leads = leerHoja_(HOJAS.leads).filter(l => ver(l.asignado_a));
  const dia = (v) => String(v || '').replace(/^'/, '').split('T')[0];
  const hora = (v) => String(v || '').replace(/^'/, '').slice(0, 5);

  const entrevistasHoy = agenda.filter(a => dia(a.fecha) === hoy && a.estado !== 'cancelado')
    .sort((a, b) => hora(a.hora).localeCompare(hora(b.hora)));
  const proxima = entrevistasHoy.find(a => a.estado === 'pendiente' && hora(a.hora) >= Utilities.formatDate(ahora, tz, 'HH:mm'));
  const leadsHoy = leads.filter(l => dia(l.fecha_asignacion) === hoy || (l.estado === 'pendiente' && dia(l.fecha_asignacion) < hoy));
  const vencidos = leads.filter(l => {
    if (l.estado !== 'pendiente') return false;
    const lim = fechaHora_(l.fecha_asignacion, l.hora_limite, tz);
    return lim && lim < ahora;
  }).map(l => {
    const lim = fechaHora_(l.fecha_asignacion, l.hora_limite, tz);
    return { id: String(l.id), cliente: l.cliente, asignado_a: l.asignado_a, interes: l.interes, telefono: l.telefono,
             vencio: hora(l.hora_limite) + ' ' + fechaCorta_(l.fecha_asignacion), minutos_atraso: Math.round((ahora - lim) / 60000) };
  }).sort((a, b) => b.minutos_atraso - a.minutos_atraso);

  const ventasMes = agenda.filter(a => a.resultado === 'venta' && dia(a.fecha).startsWith(mes));
  const ventasRecientes = agenda.filter(a => a.resultado === 'venta' && a.aviso_venta)
    .map(a => ({ id: String(a.id), cliente: a.cliente, asesor: a.asesor, vehiculo: a.vehiculo, monto: Number(a.monto) || 0, cuando: a.aviso_venta }))
    .filter(v => ahora - new Date(v.cuando) < 48 * 3600000)
    .sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)));

  return {
    ok: true,
    generado: ahora.toISOString(),
    resumen: {
      entrevistas_hoy: entrevistasHoy.length,
      leads_hoy: leadsHoy.length,
      leads_vencidos: vencidos.length,
      ventas_mes: ventasMes.length,
      facturacion_mes: ventasMes.reduce((s, v) => s + (Number(v.monto) || 0), 0)
    },
    proxima_entrevista: proxima ? { cliente: proxima.cliente, hora: hora(proxima.hora), asesor: proxima.asesor, vehiculo: proxima.vehiculo } : null,
    entrevistas_hoy: entrevistasHoy.map(a => ({ id: String(a.id), cliente: a.cliente, hora: hora(a.hora), asesor: a.asesor, estado: a.estado })),
    leads_vencidos: vencidos,
    ventas_recientes: ventasRecientes,          // últimas 48 h: el widget puede mostrar un pop-up si aparece un id nuevo
    links: {
      hub: HUB_URL,
      agenda: HUB_URL + 'crm.html?tab=agenda',
      leads: HUB_URL + 'crm.html?tab=leads',
      leads_vencidos: HUB_URL + 'crm.html?tab=leads&ver=vencidos',
      metricas: HUB_URL + 'crm.html?tab=dashboard'
    }
  };
}

// ── Utilidades de avisos ─────────────────────────────────────────
function tg_(metodo, payload) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
  if (!token) return null;
  const res = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  try { return JSON.parse(res.getContentText()); } catch (e) { return null; }
}

function fechaHora_(fecha, hora, tz) {
  let f = fecha, h = hora;
  if (f instanceof Date) f = Utilities.formatDate(f, tz, 'yyyy-MM-dd');
  if (h instanceof Date) h = Utilities.formatDate(h, tz, 'HH:mm');
  f = String(f || '').replace(/^'/, '').split('T')[0];
  h = String(h || '23:59').replace(/^'/, '').slice(0, 5) || '23:59';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{1,2}:\d{2}$/.test(h)) return null;
  try { return Utilities.parseDate(f + ' ' + h, tz, 'yyyy-MM-dd HH:mm'); } catch (e) { return null; }
}
function fechaCorta_(v) { const s = String(v || '').replace(/^'/, '').split('T')[0].split('-'); return s.length === 3 ? `${s[2]}/${s[1]}` : String(v || ''); }
function moneda_(n) { return '$ ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function esc_(v) { return String(v == null ? '' : v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }


// =====================================================================
//  CONTRATOS — control nominal de contratos (números y estados)
//  No guarda archivos. Responde a: ¿cuáles están en la calle, cuáles en gerencia,
//  cuáles completos, cargados o rendidos, y quién los tiene?
//  Flujo: Gerente Comercial carga los números → los asigna a Jefes de Ventas →
//  ellos los asignan a vendedores y referentes → el vendedor marca Completo y Cargado →
//  el jefe marca Recibido y solo gerencia marca Rendido (con el pago del sellado). Todo queda en la hoja ContratosLog.
// =====================================================================
const HOJA_CONTRATOS = 'Contratos';
const HOJA_CONTRATOS_LOG = 'ContratosLog';
const COL_CONTRATOS = ['id', 'numero', 'estado', 'responsable', 'fecha_asignacion', 'asignado_por', 'cliente', 'fecha_estado', 'sellado_monto', 'sellado_forma', 'sellado_ref', 'notas', 'actualizado', 'plan_codigo', 'plan_cuota', 'sellado_debido'];
const COL_CONTRATOS_LOG = ['fecha', 'contrato', 'usuario', 'accion', 'detalle'];
const HOJA_PRECIOS = 'Precios';
const COL_PRECIOS = ['codigo', 'vehiculo', 'apertura', 'cuota', 'sellado', 'pago_1_y_2', 'actualizado'];
const ESTADOS_CONTRATO = ['Disponible', 'Vacío', 'Completo', 'Cargado', 'Recibido', 'Rendido', 'Anulado'];
const FORMAS_SELLADO = ['Transferencia', 'Contado'];
const MAX_CONTRATOS_LOTE = 2000;

function hojaContratos_(nombre, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.getRange(1, 1, 1, cols.length).setValues([cols]); sh.setFrozenRows(1); }
  asegurarColumnas_(sh, cols);
  return sh;
}
function esGerente_(u) { return u.rol === 'Gerente Comercial'; }
function esControl_(u) { return u.rol === ROL_CONTROL; }
function esSupervisor_(u) { return u.rol === ROL_SUPERVISOR; }
function veTodoContratos_(u) { return esGerente_(u) || esControl_(u) || esSupervisor_(u); }
// Personas a las que este usuario puede asignar o ver: él mismo y quienes le reportan (gerente: todos los activos)
function ambitoContratos_(u, personal) {
  if (veTodoContratos_(u)) return personal.filter(p => String(p.estado) === 'Activo' && p.rol !== 'Personal').map(p => String(p.nombre));
  return [String(u.nombre)].concat(personal.filter(p => String(p.reporta_a) === String(u.nombre) && String(p.estado) === 'Activo').map(p => String(p.nombre)));
}
function nuevoIdContrato_() { return 'C' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function limpiarNumero_(v) { return String(v == null ? '' : v).replace(/^'/, '').trim().replace(/\s+/g, '').slice(0, 20); }
function hoyContrato_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// Convierte "1001-1050, 1062 1063" en una lista de números. Los rangos solo valen si son numéricos y no pasan del tope.
function expandirNumeros_(texto) {
  const out = [], vistos = {}; let problemas = [];
  String(texto || '').split(/[\s,;\n]+/).forEach(tk => {
    tk = limpiarNumero_(tk); if (!tk) return;
    const m = tk.match(/^(\d+)-(\d+)$/);
    if (m && Number(m[2]) >= Number(m[1])) {
      const a = Number(m[1]), b = Number(m[2]), ancho = m[1].length;
      if (b - a >= MAX_CONTRATOS_LOTE) { problemas.push(tk + ' (rango demasiado grande)'); return; }
      for (let n = a; n <= b; n++) { const s = String(n).padStart(ancho, '0'); if (!vistos[s]) { vistos[s] = 1; out.push(s); } }
      return;
    }
    if (!/^\d{1,15}$/.test(tk)) { problemas.push(tk + ' (el número de contrato tiene solo cifras)'); return; }
    if (!vistos[tk]) { vistos[tk] = 1; out.push(tk); }
  });
  return { numeros: out, problemas: problemas };
}

function leerContratos_() { return leerHoja_(HOJA_CONTRATOS).map(r => { r.numero = limpiarNumero_(r.numero); return r; }); }
function registrarLogContratos_(lista) {
  if (!lista.length) return;
  const sh = hojaContratos_(HOJA_CONTRATOS_LOG, COL_CONTRATOS_LOG);
  const ahora = new Date();
  sh.getRange(sh.getLastRow() + 1, 1, lista.length, COL_CONTRATOS_LOG.length).setValues(lista.map(l => [ahora, "'" + l.contrato, l.usuario, l.accion, l.detalle || '']));
}
function celdaContrato_(h, v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date || typeof v === 'number') return v;
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (['numero', 'fecha_asignacion', 'fecha_estado', 'sellado_ref'].indexOf(h) > -1 && s !== '' && s[0] !== "'") s = "'" + s;
  return s;
}

function despacharContratos_(body, u) {
  const a = body.action;
  if (a === 'contratos_datos') return contratosDatos_(u);
  if (a === 'contratos_precios') return { ok: true, precios: leerPrecios_() };
  if (esControl_(u) || esSupervisor_(u)) return { ok: false, error: 'sin_permiso' }; // solo lectura
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (a === 'contratos_cargar') return contratosCargar_(body, u);
    if (a === 'contratos_asignar') return contratosAsignar_(body, u);
    if (a === 'contratos_estado') return contratosEstado_(body, u);
    if (a === 'contratos_importar') return contratosImportar_(body, u);
    if (a === 'contratos_vincular') return contratosVincular_(body, u);
    if (a === 'contratos_precios_cargar') return contratosPreciosCargar_(body, u);
    if (a === 'contratos_eliminar') return contratosEliminar_(body, u);
    return { ok: false, error: 'accion_invalida' };
  } finally { lock.releaseLock(); }
}

function contratosDatos_(u) {
  const personal = personalLimpio_(), ambito = ambitoContratos_(u, personal);
  const todos = leerContratos_();
  const visibles = veTodoContratos_(u) ? todos : todos.filter(c => ambito.indexOf(String(c.responsable)) > -1);
  const gente = personal.filter(p => String(p.estado) === 'Activo').map(p => ({ nombre: p.nombre, rol: p.rol, reporta_a: p.reporta_a }));
  return { ok: true, usuario: { nombre: u.nombre, rol: u.rol }, contratos: visibles, personal: gente, ambito: ambito, estados: ESTADOS_CONTRATO, precios: leerPrecios_(), servidor: new Date().toISOString() };
}

// Gerencia carga los números disponibles (en gerencia, todavía sin repartir).
function contratosCargar_(body, u) {
  if (!esGerente_(u)) return { ok: false, error: 'sin_permiso' };
  const ex = expandirNumeros_(body.numeros);
  if (!ex.numeros.length) return { ok: false, error: 'sin_numeros', problemas: ex.problemas };
  if (ex.numeros.length > MAX_CONTRATOS_LOTE) return { ok: false, error: 'demasiados' };
  const sh = hojaContratos_(HOJA_CONTRATOS, COL_CONTRATOS), h = asegurarColumnas_(sh, COL_CONTRATOS);
  const existentes = {}; leerContratos_().forEach(c => { existentes[c.numero] = 1; });
  const nuevos = ex.numeros.filter(n => !existentes[n]), repetidos = ex.numeros.filter(n => existentes[n]);
  const ahora = new Date(), hoy = hoyContrato_();
  if (nuevos.length) {
    const filas = nuevos.map((n, i) => h.map(col => celdaContrato_(col, ({ id: nuevoIdContrato_(), numero: n, estado: 'Disponible', responsable: '', fecha_estado: hoy, actualizado: ahora })[col])));
    sh.getRange(sh.getLastRow() + 1, 1, filas.length, h.length).setValues(filas);
    registrarLogContratos_(nuevos.map(n => ({ contrato: n, usuario: u.nombre, accion: 'cargado', detalle: 'Disponible en gerencia' })));
  }
  return { ok: true, cargados: nuevos.length, repetidos: repetidos, problemas: ex.problemas };
}

// Aplica cambios a filas existentes (por id) y registra el log.
function actualizarContratos_(cambios, u, accion, detalleFn) {
  const sh = hojaContratos_(HOJA_CONTRATOS, COL_CONTRATOS), h = asegurarColumnas_(sh, COL_CONTRATOS);
  const datos = sh.getDataRange().getValues(), iId = h.indexOf('id'), logs = [];
  const pos = {}; for (let i = 1; i < datos.length; i++) pos[String(datos[i][iId])] = i;
  cambios.forEach(cb => {
    const i = pos[cb.id]; if (i === undefined) return;
    const fila = datos[i];
    Object.keys(cb.campos).forEach(k => { const j = h.indexOf(k); if (j > -1) fila[j] = celdaContrato_(k, cb.campos[k]); });
    fila[h.indexOf('actualizado')] = new Date();
    sh.getRange(i + 1, 1, 1, h.length).setValues([fila]);
    logs.push({ contrato: cb.numero, usuario: u.nombre, accion: accion, detalle: detalleFn(cb) });
  });
  registrarLogContratos_(logs);
}

// Asignar (o reasignar / devolver a gerencia). Gerencia: a cualquiera. Jefe o referente: a sí mismo o a quien le reporta.
function contratosAsignar_(body, u) {
  if (SUPERVISION_CONTRATOS_.indexOf(u.rol) < 0) return { ok: false, error: 'sin_permiso' };
  const personal = personalLimpio_(), ambito = ambitoContratos_(u, personal);
  const dest = String(body.responsable || '').trim();
  const devolver = dest === '';
  if (!devolver && ambito.indexOf(dest) < 0) return { ok: false, error: 'destino_fuera_de_alcance' };
  const ids = (body.ids || []).map(String), todos = leerContratos_(), mapa = {}; todos.forEach(c => { mapa[String(c.id)] = c; });
  const cambios = [], omitidos = [], hoy = hoyContrato_();
  ids.forEach(id => {
    const c = mapa[id]; if (!c) { omitidos.push({ id: id, motivo: 'no_existe' }); return; }
    const mio = esGerente_(u) || ambito.indexOf(String(c.responsable)) > -1;
    if (!mio) { omitidos.push({ numero: c.numero, motivo: 'no_es_de_su_equipo' }); return; }
    if (['Disponible', 'Vacío'].indexOf(String(c.estado)) < 0) { omitidos.push({ numero: c.numero, motivo: 'ya_en_proceso' }); return; }
    if (devolver) cambios.push({ id: id, numero: c.numero, campos: { estado: 'Disponible', responsable: '', fecha_asignacion: '', asignado_por: '', fecha_estado: hoy }, desde: c.responsable });
    else cambios.push({ id: id, numero: c.numero, campos: { estado: 'Vacío', responsable: dest, fecha_asignacion: hoy, asignado_por: u.nombre, fecha_estado: hoy }, desde: c.responsable });
  });
  if (devolver && !esGerente_(u)) { /* un jefe puede devolver a gerencia lo suyo */ }
  actualizarContratos_(cambios, u, devolver ? 'devuelto' : 'asignado', cb => devolver ? ('Vuelve a gerencia (tenía ' + (cb.desde || 'gerencia') + ')') : ((cb.desde ? cb.desde + ' → ' : '') + dest));
  return { ok: true, cambiados: cambios.length, omitidos: omitidos };
}

const SUPERVISION_CONTRATOS_ = ['Gerente Comercial', 'Jefe de Ventas', 'Referente'];
const SIGUIENTE_CONTRATO_ = { 'Vacío': 'Completo', 'Completo': 'Cargado', 'Cargado': 'Recibido', 'Recibido': 'Rendido' };

// Cambio de estado. El responsable avanza Vacío → Completo → Cargado. Rendido, retrocesos y anulación son de supervisión
// (Rendido pide el sellado: forma y referencia). Anulado solo gerencia.
function contratosEstado_(body, u) {
  const nuevo = String(body.estado || '');
  if (ESTADOS_CONTRATO.indexOf(nuevo) < 0 || nuevo === 'Disponible') return { ok: false, error: 'estado_invalido' };
  const personal = personalLimpio_(), ambito = ambitoContratos_(u, personal), supervisa = SUPERVISION_CONTRATOS_.indexOf(u.rol) > -1;
  const ids = (body.ids || []).map(String), todos = leerContratos_(), mapa = {}; todos.forEach(c => { mapa[String(c.id)] = c; });
  const s = body.sellado || {};
  if (nuevo === 'Rendido') {
    if (!esGerente_(u)) return { ok: false, error: 'sin_permiso' };
    if (FORMAS_SELLADO.indexOf(String(s.forma)) < 0) return { ok: false, error: 'falta_forma_sellado' };
    if (String(s.referencia || '').trim().length < 3) return { ok: false, error: 'falta_referencia_sellado' };
  }
  if (nuevo === 'Anulado' && !esGerente_(u)) return { ok: false, error: 'sin_permiso' };
  if (nuevo === 'Recibido' && !supervisa) return { ok: false, error: 'sin_permiso' };
  const cambios = [], omitidos = [], hoy = hoyContrato_();
  ids.forEach(id => {
    const c = mapa[id]; if (!c) { omitidos.push({ id: id, motivo: 'no_existe' }); return; }
    const mio = String(c.responsable) === String(u.nombre), delEquipo = ambito.indexOf(String(c.responsable)) > -1;
    if (!(esGerente_(u) || (supervisa && delEquipo) || mio)) { omitidos.push({ numero: c.numero, motivo: 'no_es_suyo' }); return; }
    const actual = String(c.estado);
    if (actual === 'Rendido' && !esGerente_(u)) { omitidos.push({ numero: c.numero, motivo: 'ya_rendido' }); return; }
    if (actual === 'Anulado' && !esGerente_(u)) { omitidos.push({ numero: c.numero, motivo: 'anulado' }); return; }
    if (actual === 'Disponible' && nuevo !== 'Anulado') { omitidos.push({ numero: c.numero, motivo: 'primero_asignar' }); return; }
    const avanza = SIGUIENTE_CONTRATO_[actual] === nuevo;
    const libre = esGerente_(u) || (supervisa && delEquipo);          // correcciones: retroceder o saltear
    if (!avanza && !libre) { omitidos.push({ numero: c.numero, motivo: 'transicion_no_permitida' }); return; }
    if (nuevo === 'Rendido' && ['Completo', 'Cargado'].indexOf(actual) < 0 && !esGerente_(u)) { omitidos.push({ numero: c.numero, motivo: 'debe_estar_completo_o_cargado' }); return; }
    const campos = { estado: nuevo, fecha_estado: hoy };
    if (body.cliente !== undefined && ids.length === 1) campos.cliente = String(body.cliente).slice(0, 80);
    if (body.notas !== undefined && ids.length === 1) campos.notas = String(body.notas).slice(0, 200);
    if (nuevo === 'Rendido') { campos.sellado_forma = s.forma; campos.sellado_ref = String(s.referencia).trim().slice(0, 80); campos.sellado_monto = s.monto === '' || s.monto == null ? (Number(c.sellado_debido) || '') : Number(String(s.monto).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || ''; }
    if (nuevo === 'Vacío') { campos.sellado_forma = ''; campos.sellado_ref = ''; campos.sellado_monto = ''; }
    cambios.push({ id: id, numero: c.numero, campos: campos, desde: actual });
  });
  actualizarContratos_(cambios, u, 'estado', cb => cb.desde + ' → ' + nuevo + (nuevo === 'Rendido' ? ' · sellado ' + s.forma + ' ' + String(s.referencia).trim() : ''));
  return { ok: true, cambiados: cambios.length, omitidos: omitidos };
}

// Carga masiva de lo que ya está repartido (solo gerencia). Una línea por contrato: numero;responsable;estado[;cliente]
// Si el contrato ya existe, se actualiza; si no, se crea.
function contratosImportar_(body, u) {
  if (!esGerente_(u)) return { ok: false, error: 'sin_permiso' };
  const personal = personalLimpio_(), activos = {}; personal.filter(p => String(p.estado) === 'Activo').forEach(p => { activos[String(p.nombre).toLowerCase()] = String(p.nombre); });
  const lineas = String(body.texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lineas.length > MAX_CONTRATOS_LOTE) return { ok: false, error: 'demasiados' };
  const sh = hojaContratos_(HOJA_CONTRATOS, COL_CONTRATOS), h = asegurarColumnas_(sh, COL_CONTRATOS);
  const existentes = {}; leerContratos_().forEach(c => { existentes[c.numero] = c; });
  const errores = [], nuevasFilas = [], cambios = [], logs = [], hoy = hoyContrato_(), ahora = new Date(), vistos = {};
  lineas.forEach((l, n) => {
    const p = l.split(/[;\t]/).map(x => x.trim());
    const num = limpiarNumero_(p[0]), resp = p[1] || '', est = (p[2] || '').trim(), cli = (p[3] || '').slice(0, 80);
    if (!/^\d{1,15}$/.test(num)) { errores.push({ linea: n + 1, texto: l, motivo: l.indexOf(';') < 0 && l.indexOf('\t') < 0 ? 'faltan los ; entre número, responsable y estado (ej. 64765;Daniel Arancibia;Vacío)' : 'el número de contrato tiene solo cifras' }); return; }
    if (vistos[num]) { errores.push({ linea: n + 1, texto: l, motivo: 'número repetido en la lista' }); return; }
    vistos[num] = 1;
    const coincide = est ? ESTADOS_CONTRATO.find(e => e.toLowerCase() === est.toLowerCase().replace('vacio', 'vacío')) : null;
    if (est && !coincide) { errores.push({ linea: n + 1, texto: l, motivo: 'estado inválido' }); return; }
    const estado = coincide || (resp ? 'Vacío' : 'Disponible');
    const responsable = resp ? activos[resp.toLowerCase()] : '';
    if (resp && !responsable) { errores.push({ linea: n + 1, texto: l, motivo: 'responsable no encontrado en Personal' }); return; }
    if (estado !== 'Disponible' && estado !== 'Anulado' && !responsable) { errores.push({ linea: n + 1, texto: l, motivo: 'falta el responsable' }); return; }
    const campos = { estado: estado, responsable: estado === 'Disponible' || estado === 'Anulado' ? '' : responsable, fecha_asignacion: responsable ? hoy : '', asignado_por: responsable ? u.nombre : '', cliente: cli, fecha_estado: hoy, sellado_forma: estado === 'Rendido' ? 'Carga inicial' : '' };
    const ex = existentes[num];
    if (ex) { cambios.push({ id: String(ex.id), numero: num, campos: campos, desde: ex.estado }); }
    else {
      nuevasFilas.push(h.map(col => celdaContrato_(col, Object.assign({ id: nuevoIdContrato_(), numero: num, actualizado: ahora }, campos)[col])));
      logs.push({ contrato: num, usuario: u.nombre, accion: 'importado', detalle: estado + (responsable ? ' · ' + responsable : '') });
    }
  });
  if (nuevasFilas.length) sh.getRange(sh.getLastRow() + 1, 1, nuevasFilas.length, h.length).setValues(nuevasFilas);
  registrarLogContratos_(logs);
  actualizarContratos_(cambios, u, 'importado', cb => (cb.desde || '—') + ' → ' + cb.campos.estado + (cb.campos.responsable ? ' · ' + cb.campos.responsable : ''));
  return { ok: true, creados: nuevasFilas.length, actualizados: cambios.length, errores: errores };
}


// Venta cerrada en el CRM: el N.º de contrato cargado marca el contrato como Completo (si estaba Vacío y es de quien vende).
// Nunca pisa estados más avanzados. Si el número se corrigió, el anterior vuelve a Vacío (solo si estaba Completo por esa misma venta).
// Devuelve ok:true con un "resultado" para que el CRM avise; no lanza error por números mal tipeados.
function contratosVincular_(body, u) {
  const numero = limpiarNumero_(body.numero), anterior = limpiarNumero_(body.anterior), cliente = String(body.cliente || '').slice(0, 80);
  const asesor = String(body.asesor || u.nombre), codigo = String(body.codigo || '').trim().toUpperCase();
  if (!numero) return { ok: true, resultado: 'sin_numero' };
  const plan = codigo ? leerPrecios_().filter(p => String(p.codigo).toUpperCase() === codigo)[0] : null;
  if (codigo && !plan) return { ok: true, resultado: 'codigo_invalido', codigo: codigo, numero: numero };
  const personal = personalLimpio_(), ambito = ambitoContratos_(u, personal), todos = leerContratos_();
  const hallar = n => todos.filter(c => String(c.numero) === String(n))[0];
  const c = hallar(numero);
  const res = { ok: true, numero: numero, revertido: false };
  const cambios = [];
  if (anterior && anterior !== numero) {
    const a = hallar(anterior), mioA = a && (esGerente_(u) || String(a.responsable) === u.nombre || String(a.responsable) === asesor || ambito.indexOf(String(a.responsable)) > -1);
    if (a && mioA && a.estado === 'Completo' && String(a.cliente) === cliente) { cambios.push({ id: a.id, numero: a.numero, campos: { estado: 'Vacío', fecha_estado: hoyContrato_(), cliente: '', plan_codigo: '', plan_cuota: '', sellado_debido: '' }, desde: 'Completo' }); res.revertido = anterior; }
  }
  if (!c) res.resultado = 'no_existe';
  else if (!(esGerente_(u) || String(c.responsable) === u.nombre || String(c.responsable) === asesor || ambito.indexOf(String(c.responsable)) > -1)) res.resultado = 'no_es_suyo';
  else if (c.estado === 'Anulado') res.resultado = 'anulado';
  else if (c.estado === 'Disponible') res.resultado = 'sin_asignar';
  else if (c.estado !== 'Vacío' && !(c.estado === 'Completo' && String(c.cliente) === cliente)) { res.resultado = 'sin_cambio'; res.estado = c.estado; }
  else {
    const campos = { estado: 'Completo', fecha_estado: c.estado === 'Completo' ? c.fecha_estado : hoyContrato_(), cliente: cliente };
    if (plan) { campos.plan_codigo = plan.codigo; campos.plan_cuota = Number(plan.cuota) || ''; campos.sellado_debido = Number(plan.sellado) || ''; res.sellado = campos.sellado_debido; res.cuota = campos.plan_cuota; }
    cambios.push({ id: c.id, numero: c.numero, campos: campos, desde: c.estado }); res.resultado = 'completado';
  }
  if (cambios.length) actualizarContratos_(cambios, u, 'venta_crm', cb => cb.desde + ' → ' + cb.campos.estado + ' (venta en el CRM' + (cliente ? ': ' + cliente : '') + ')');
  return res;
}


// ── Lista de precios (planes) ────────────────────────────────────────────────
// Hoja "Precios": codigo, vehiculo, apertura (cuota en que se abre carpeta; informativo), cuota (adelanto mensual), sellado, pago_1_y_2 (informativo).
function leerPrecios_() { return leerHoja_(HOJA_PRECIOS).map(r => ({ codigo: String(r.codigo), vehiculo: r.vehiculo, apertura: r.apertura, cuota: Number(r.cuota) || 0, sellado: Number(r.sellado) || 0, pago_1_y_2: Number(r.pago_1_y_2) || 0 })); }
function montoPrecio_(v) {
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t) return NaN;
  if (t.indexOf(',') > -1) t = t.replace(/\./g, '').replace(',', '.'); else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t); return isFinite(n) && n >= 0 ? n : NaN;
}
// texto: un plan por renglón "codigo;vehiculo;apertura;cuota;sellado;pago" (o separado por tabulaciones o por comas con espacio, como al copiar de Excel o Word)
// modo 'reemplazar': el listado nuevo reemplaza al anterior (solo si no hay errores). modo 'actualizar': agrega o cambia solo esos códigos.
function contratosPreciosCargar_(body, u) {
  if (!esGerente_(u)) return { ok: false, error: 'sin_permiso' };
  const modo = body.modo === 'reemplazar' ? 'reemplazar' : 'actualizar';
  const lineas = String(body.texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lineas.length) return { ok: false, error: 'sin_datos' };
  if (lineas.length > 500) return { ok: false, error: 'demasiados' };
  const filas = [], errores = [], vistos = {};
  lineas.forEach((l, i) => {
    const c = (l.indexOf('\t') > -1 ? l.split('\t') : l.indexOf(';') > -1 ? l.split(';') : l.split(/,\s+/)).map(x => x.trim());
    if (i === 0 && /^c[oó]digo$/i.test(c[0])) return;
    const codigo = String(c[0] || '').toUpperCase().replace(/\s+/g, '');
    const cuota = montoPrecio_(c[3]), sellado = montoPrecio_(c[4]);
    let pago = c[5] === undefined || c[5] === '' ? NaN : montoPrecio_(c[5]);
    if (!/^[A-Z0-9._-]{1,20}$/.test(codigo)) { errores.push({ linea: i + 1, texto: l.slice(0, 60), motivo: 'código no válido' }); return; }
    if (vistos[codigo]) { errores.push({ linea: i + 1, texto: l.slice(0, 60), motivo: 'código repetido en la lista' }); return; }
    if (isNaN(cuota)) { errores.push({ linea: i + 1, texto: l.slice(0, 60), motivo: 'falta el valor de cuota' }); return; }
    if (isNaN(sellado)) { errores.push({ linea: i + 1, texto: l.slice(0, 60), motivo: 'falta el sellado' }); return; }
    if (isNaN(pago)) pago = cuota + sellado;
    vistos[codigo] = 1;
    filas.push([codigo, String(c[1] || '').slice(0, 80), String(c[2] || '').replace(/[^\d]/g, ''), cuota, sellado, pago, new Date()]);
  });
  if (modo === 'reemplazar' && errores.length) return { ok: false, error: 'hay_errores', errores: errores };
  if (!filas.length) return { ok: false, error: 'sin_datos', errores: errores };
  const sh = hojaContratos_(HOJA_PRECIOS, COL_PRECIOS), h = asegurarColumnas_(sh, COL_PRECIOS);
  let creados = 0, actualizados = 0;
  if (modo === 'reemplazar') {
    for (let r = sh.getLastRow(); r >= 2; r--) sh.deleteRow(r);
    filas.forEach(f => sh.appendRow(f)); creados = filas.length;
  } else {
    const datos = sh.getDataRange().getValues(), pos = {}; for (let i = 1; i < datos.length; i++) pos[String(datos[i][h.indexOf('codigo')]).toUpperCase()] = i + 1;
    filas.forEach(f => { if (pos[f[0]]) { sh.getRange(pos[f[0]], 1, 1, COL_PRECIOS.length).setValues([f]); actualizados++; } else { sh.appendRow(f); creados++; } });
  }
  registrarLogContratos_([{ contrato: '(precios)', usuario: u.nombre, accion: 'precios', detalle: modo + ': ' + creados + ' nuevos, ' + actualizados + ' actualizados' }]);
  return { ok: true, modo: modo, creados: creados, actualizados: actualizados, errores: errores, total: leerPrecios_().length };
}


// Quita de la hoja contratos cargados por error. Solo gerencia, y solo si están en gerencia (Disponible) o Anulados: nunca uno que esté en la calle o rendido.
function contratosEliminar_(body, u) {
  if (!esGerente_(u)) return { ok: false, error: 'sin_permiso' };
  const ids = (body.ids || []).map(String), sh = hojaContratos_(HOJA_CONTRATOS, COL_CONTRATOS), h = asegurarColumnas_(sh, COL_CONTRATOS);
  const datos = sh.getDataRange().getValues(), iId = h.indexOf('id'), iE = h.indexOf('estado'), iN = h.indexOf('numero'), iR = h.indexOf('responsable');
  const borrar = [], omitidos = [], logs = [];
  for (let i = 1; i < datos.length; i++) {
    if (ids.indexOf(String(datos[i][iId])) < 0) continue;
    const num = limpiarNumero_(datos[i][iN]), est = String(datos[i][iE]);
    if (['Disponible', 'Anulado'].indexOf(est) < 0 || String(datos[i][iR])) { omitidos.push({ numero: num, motivo: 'solo_disponible_o_anulado' }); continue; }
    borrar.push(i + 1); logs.push({ contrato: num, usuario: u.nombre, accion: 'eliminado', detalle: 'quitado del listado (' + est + ')' });
  }
  borrar.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
  registrarLogContratos_(logs);
  return { ok: true, eliminados: borrar.length, omitidos: omitidos };
}


// =====================================================================
//  ASISTENCIA — ingreso y egreso del personal que cobra por horas
//  La hora la pone el SERVIDOR (no el teléfono), así no se puede adelantar ni atrasar.
//  Cada persona marca «Ingreso» y «Salida»; puede haber más de un turno por día.
//  Gerencia ve a todos, corrige olvidos (queda registrado quién y por qué) y exporta la semana en PDF.
//  Rol «Personal»: solo entra a esta herramienta.
// =====================================================================
const HOJA_ASISTENCIA = 'Asistencia';
const COL_ASISTENCIA = ['id', 'nombre', 'fecha', 'entrada', 'salida', 'minutos', 'entrada_ts', 'salida_ts', 'nota', 'editado_por', 'actualizado'];
const ROL_PERSONAL = 'Personal';
const MAX_TURNO_HORAS = 16;   // una salida marcada más tarde que esto queda señalada para revisar
function esPersonal_(u) { return u.rol === ROL_PERSONAL; }
function veTodaAsistencia_(u) { return esGerente_(u) || esSupervisor_(u); }

function hojaAsistencia_() { return hojaContratos_(HOJA_ASISTENCIA, COL_ASISTENCIA); }
function tzA_() { return Session.getScriptTimeZone(); }
function diaA_(d) { return Utilities.formatDate(d, tzA_(), 'yyyy-MM-dd'); }
function horaA_(d) { return Utilities.formatDate(d, tzA_(), 'HH:mm'); }
function textoA_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function celdaA_(h, v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date || typeof v === 'number') return v;
  let s = String(v); if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (['fecha', 'entrada', 'salida'].indexOf(h) > -1 && s !== '' && s[0] !== "'") s = "'" + s;
  return s;
}
function leerAsistencia_() {
  const sh = hojaAsistencia_();
  const datos = sh.getDataRange().getValues(); if (datos.length < 2) return [];
  const h = datos[0].map(x => String(x).trim().toLowerCase());
  const out = [];
  for (let i = 1; i < datos.length; i++) {
    const f = datos[i]; if (!f.some(c => c !== '' && c !== null)) continue;
    const o = { _fila: i + 1 };
    h.forEach((k, j) => {
      let v = f[j];
      if (v instanceof Date) v = (k === 'entrada_ts' || k === 'salida_ts' || k === 'actualizado') ? v.toISOString() : (k === 'fecha' ? diaA_(v) : horaA_(v));
      o[k] = typeof v === 'string' ? textoA_(v) : v;
    });
    o.minutos = Number(o.minutos) || 0;
    out.push(o);
  }
  return out;
}
function publicoA_(r) { const o = Object.assign({}, r); delete o._fila; return o; }
function escribirFilaA_(sh, fila, r) {
  const h = asegurarColumnas_(sh, COL_ASISTENCIA);
  sh.getRange(fila, 1, 1, h.length).setValues([h.map(k => celdaA_(k, r[k]))]);
}
// Minutos entre dos horas del mismo turno («08:00» → «12:30»); si la salida es menor, el turno pasó la medianoche
function minutosEntre_(ent, sal) {
  const m = (t) => { const p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1]); };
  if (!/^\d{1,2}:\d{2}$/.test(ent || '') || !/^\d{1,2}:\d{2}$/.test(sal || '')) return 0;
  let d = m(sal) - m(ent); if (d < 0) d += 1440; return d;
}
function lunesDe_(iso) {
  const p = String(iso).split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
function sumarDias_(iso, n) { const p = String(iso).split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.toISOString().slice(0, 10); }

function despacharAsistencia_(body, u) {
  const a = body.action;
  if (a === 'asistencia_datos') return asistenciaDatos_(body, u);
  if (esSupervisor_(u)) return { ok: false, error: 'sin_permiso' }; // solo lectura
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (a === 'asistencia_marcar') return asistenciaMarcar_(body, u);
    if (a === 'asistencia_corregir') return asistenciaCorregir_(body, u);
    return { ok: false, error: 'accion_invalida' };
  } finally { lock.releaseLock(); }
}

function asistenciaDatos_(body, u) {
  const todos = leerAsistencia_();
  const hoy = diaA_(new Date());
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(body.desde || '') ? lunesDe_(body.desde) : lunesDe_(hoy);
  const hasta = sumarDias_(desde, 6);
  let quien = String(u.nombre);
  if (veTodaAsistencia_(u) && body.nombre) quien = String(body.nombre);
  const mios = todos.filter(r => String(r.nombre) === quien);
  const abierto = mios.filter(r => r.entrada_ts && !r.salida_ts).pop() || null;
  const semana = mios.filter(r => r.fecha >= desde && r.fecha <= hasta).sort((x, y) => (x.fecha + x.entrada).localeCompare(y.fecha + y.entrada));
  const out = { ok: true, ahora: new Date().toISOString(), hoy: hoy, desde: desde, hasta: hasta, nombre: quien, abierto: abierto ? publicoA_(abierto) : null, semana: semana.map(publicoA_) };
  if (veTodaAsistencia_(u)) {
    const personal = personalLimpio_().filter(p => String(p.estado) === 'Activo');
    const conRegistros = {}; todos.forEach(r => { conRegistros[r.nombre] = 1; });
    out.personas = personal.filter(p => p.rol === ROL_PERSONAL || conRegistros[p.nombre]).map(p => p.nombre);
    if (out.personas.indexOf(quien) < 0) out.personas.unshift(quien);
    // quién está adentro ahora
    out.adentro = todos.filter(r => r.entrada_ts && !r.salida_ts).map(r => ({ nombre: r.nombre, desde: r.entrada, fecha: r.fecha }));
  }
  return out;
}

function asistenciaMarcar_(body, u) {
  const tipo = body.tipo === 'salida' ? 'salida' : body.tipo === 'entrada' ? 'entrada' : '';
  if (!tipo) return { ok: false, error: 'tipo_invalido' };
  const sh = hojaAsistencia_();
  const mios = leerAsistencia_().filter(r => String(r.nombre) === String(u.nombre));
  const abierto = mios.filter(r => r.entrada_ts && !r.salida_ts).pop();
  const ahora = new Date();
  if (tipo === 'entrada') {
    if (abierto) return { ok: false, error: 'ya_adentro', abierto: publicoA_(abierto) };
    const r = { id: 'A' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), nombre: u.nombre, fecha: diaA_(ahora), entrada: horaA_(ahora), salida: '', minutos: '', entrada_ts: ahora, salida_ts: '', nota: '', editado_por: '', actualizado: ahora };
    const h = asegurarColumnas_(sh, COL_ASISTENCIA);
    sh.appendRow(h.map(k => celdaA_(k, r[k])));
    return { ok: true, registro: { id: r.id, nombre: r.nombre, fecha: r.fecha, entrada: r.entrada, salida: '', minutos: 0, entrada_ts: ahora.toISOString() } };
  }
  if (!abierto) return { ok: false, error: 'sin_entrada' };
  const ini = new Date(abierto.entrada_ts);
  const min = Math.max(0, Math.round((ahora - ini) / 60000));
  const r = Object.assign({}, abierto, { salida: horaA_(ahora), salida_ts: ahora, minutos: min, actualizado: ahora, entrada_ts: ini });
  if (min > MAX_TURNO_HORAS * 60) r.nota = (r.nota ? r.nota + ' · ' : '') + 'Revisar: la salida se marcó ' + Math.round(min / 60) + ' h después del ingreso';
  escribirFilaA_(sh, abierto._fila, r);
  const pub = publicoA_(r); pub.salida_ts = ahora.toISOString(); pub.entrada_ts = ini.toISOString();
  return { ok: true, registro: pub, revisar: min > MAX_TURNO_HORAS * 60 };
}

// Solo gerencia: corregir un turno (olvido de marcar), cargar uno a mano o anularlo. Siempre con motivo.
function asistenciaCorregir_(body, u) {
  if (!esGerente_(u)) return { ok: false, error: 'sin_permiso' };
  const motivo = String(body.motivo || '').trim().slice(0, 200);
  if (!motivo) return { ok: false, error: 'falta_motivo' };
  const sh = hojaAsistencia_();
  const todos = leerAsistencia_();
  const ahora = new Date();
  const hora = (v) => /^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v).padStart(5, '0') : '';
  const firma = u.nombre + ' (' + Utilities.formatDate(ahora, tzA_(), 'dd/MM HH:mm') + '): ' + motivo;
  if (body.borrar) {
    const r = todos.find(x => x.id === body.id); if (!r) return { ok: false, error: 'no_encontrado' };
    archivarEliminado_(HOJA_ASISTENCIA, Object.assign(publicoA_(r), { cliente: r.nombre + ' ' + r.fecha }), u);
    sh.deleteRow(r._fila);
    return { ok: true, borrado: r.id };
  }
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(body.fecha || '') ? body.fecha : '';
  const ent = hora(body.entrada), sal = hora(body.salida);
  if (!ent) return { ok: false, error: 'falta_entrada' };
  if (body.id) {
    const r = todos.find(x => x.id === body.id); if (!r) return { ok: false, error: 'no_encontrado' };
    const nuevo = Object.assign({}, r, { fecha: fecha || r.fecha, entrada: ent, salida: sal, minutos: sal ? minutosEntre_(ent, sal) : '', nota: (r.nota ? r.nota + ' · ' : '') + 'Corregido por ' + firma, editado_por: u.nombre, actualizado: ahora });
    if (sal && !r.salida_ts) nuevo.salida_ts = ahora; // se cierra el turno abierto
    if (r.entrada_ts) nuevo.entrada_ts = new Date(r.entrada_ts);
    if (nuevo.salida_ts && !(nuevo.salida_ts instanceof Date)) nuevo.salida_ts = new Date(nuevo.salida_ts);
    escribirFilaA_(sh, r._fila, nuevo);
    return { ok: true };
  }
  const nombre = String(body.nombre || '');
  if (!nombre || !personalLimpio_().some(p => p.nombre === nombre)) return { ok: false, error: 'persona_invalida' };
  if (!fecha) return { ok: false, error: 'falta_fecha' };
  if (!sal) return { ok: false, error: 'falta_salida' };
  const r = { id: 'A' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), nombre, fecha, entrada: ent, salida: sal, minutos: minutosEntre_(ent, sal), entrada_ts: ahora, salida_ts: ahora, nota: 'Cargado a mano por ' + firma, editado_por: u.nombre, actualizado: ahora };
  const h = asegurarColumnas_(sh, COL_ASISTENCIA);
  sh.appendRow(h.map(k => celdaA_(k, r[k])));
  return { ok: true, id: r.id };
}

// =====================================================================
//  PADRINOS X5 — club de referidos y fidelización (v2.7)
//  Cada cliente con plan puede ser «padrino»: recibe un código y suma puntos cuando alguien
//  que él recomienda avanza (entrevista, firma, cuota 3, retiro). Los puntos se calculan en la app;
//  acá se guardan los padrinos, los referidos y cada cambio de estado (con quién y cuándo).
//  Al cargar un referido se crea el lead en el CRM (origen «Referido») y se avisa al asesor.
//  Reglas: cuota 3, retiro y baja los confirma supervisión (gerente, jefe, referente).
//  Rol «Supervisor»: solo lectura. Rol «Control» y «Personal»: sin acceso.
// =====================================================================
const HOJA_PADRINOS = 'Padrinos';
const HOJA_REFERIDOS = 'Referidos';
const HOJA_PADRINOS_LOG = 'PadrinosLog';
const COL_PADRINOS = ['id', 'codigo', 'nombre', 'telefono', 'cumple', 'nro_contrato', 'asesor', 'cuotas_al_dia', 'retiro', 'fecha_retiro', 'resena', 'estado', 'alta', 'notas', 'actualizado'];
const COL_REFERIDOS = ['id', 'padrino_id', 'padrino_codigo', 'cliente', 'telefono', 'interes', 'sistema', 'asesor', 'estado', 'nro_contrato', 'lead_id', 'alta', 'fecha_entrevista', 'fecha_firma', 'fecha_cuota3', 'fecha_retiro', 'fecha_baja', 'notas', 'actualizado'];
const COL_PADRINOS_LOG = ['fecha', 'usuario', 'accion', 'detalle'];
const ESTADOS_REFERIDO = ['camino', 'entrevista', 'firmo', 'cuota3', 'retiro'];
const ESTADOS_SOLO_SUPERVISION = ['cuota3', 'retiro', 'baja'];
const SISTEMAS_PLAN = ['10 adelantos', '5 adelantos', 'Entrega programada'];

function hojaPadrinos_() { return hojaContratos_(HOJA_PADRINOS, COL_PADRINOS); }
function hojaReferidos_() { return hojaContratos_(HOJA_REFERIDOS, COL_REFERIDOS); }
function hoyP_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function txtP_(v) { return String(v == null ? '' : v).replace(/^'/, '').trim(); }
// Teléfono argentino normalizado a 10 dígitos (sin 54, 9, 0 ni 15), igual que el botón de WhatsApp del CRM
function telP_(v) {
  let d = txtP_(v).replace(/\D/g, '');
  if (d.indexOf('54') === 0 && d.length > 10) { d = d.slice(2); if (d.charAt(0) === '9') d = d.slice(1); }
  if (d.charAt(0) === '0') d = d.slice(1);
  if (d.length === 12) d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  return d;
}
function celdaP_(h, v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return v;
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (['telefono', 'cumple', 'nro_contrato', 'codigo', 'alta'].indexOf(h) > -1 || h.indexOf('fecha_') === 0) { if (s !== '' && s[0] !== "'") s = "'" + s; }
  return s;
}
function leerP_(sh, cols) {
  asegurarColumnas_(sh, cols);
  const datos = sh.getDataRange().getValues(); if (datos.length < 2) return [];
  const h = datos[0].map(x => String(x).trim().toLowerCase()), tz = Session.getScriptTimeZone();
  const out = [];
  for (let i = 1; i < datos.length; i++) {
    const f = datos[i]; if (!f.some(c => c !== '' && c !== null)) continue;
    const o = { _fila: i + 1 };
    h.forEach((k, j) => {
      if (!k) return;
      let v = f[j];
      if (v instanceof Date) v = k === 'actualizado' ? v.toISOString() : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      o[k] = typeof v === 'string' ? txtP_(v) : v;
    });
    out.push(o);
  }
  return out;
}
function escribirP_(sh, cols, fila, obj) {
  const h = asegurarColumnas_(sh, cols);
  const vals = h.map(k => k === 'actualizado' ? new Date() : celdaP_(k, obj[k]));
  if (fila > 0) sh.getRange(fila, 1, 1, h.length).setValues([vals]); else sh.appendRow(vals);
}
function publicoP_(o) { const c = Object.assign({}, o); delete c._fila; return c; }
function logP_(u, accion, detalle) {
  try { hojaContratos_(HOJA_PADRINOS_LOG, COL_PADRINOS_LOG).appendRow([new Date(), u.nombre, accion, detalle]); } catch (e) {}
}
function nuevoCodigoPadrino_(existentes) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para que se dicte sin errores
  for (let n = 0; n < 50; n++) {
    let c = 'X5-'; for (let i = 0; i < 5; i++) c += abc.charAt(Math.floor(Math.random() * abc.length));
    if (existentes.indexOf(c) < 0) return c;
  }
  throw new Error('sin_codigo');
}

function despacharPadrinos_(body, u) {
  if (esControl_(u) || esPersonal_(u)) return { ok: false, error: 'sin_permiso' };
  const a = body.action;
  if (a === 'padrinos_datos') return padrinosDatos_(u);
  if (esSupervisor_(u)) return { ok: false, error: 'sin_permiso' }; // solo lectura
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  const avisos = [];
  try {
    if (a === 'padrinos_guardar') return padrinosGuardar_(body, u);
    if (a === 'referidos_guardar') return referidosGuardar_(body, u, avisos);
    if (a === 'referidos_estado') return referidosEstado_(body, u);
    return { ok: false, error: 'accion_invalida' };
  } finally {
    lock.releaseLock();
    avisos.forEach(fn => { try { fn(); } catch (e) { console.warn('Aviso no enviado: ' + e); } });
  }
}

function padrinosDatos_(u) {
  const personal = personalLimpio_().filter(p => p.rol !== 'Personal');
  const ve = visibilidad_(u, personal);
  const padrinos = leerP_(hojaPadrinos_(), COL_PADRINOS);
  const referidos = leerP_(hojaReferidos_(), COL_REFERIDOS);
  // Un asesor ve los padrinos que atiende él o su equipo, y todos los referidos de esos padrinos (para que el puntaje sea completo)
  const visibles = padrinos.filter(p => ve(p.asesor));
  const ids = visibles.map(p => String(p.id));
  return {
    ok: true, usuario: { nombre: u.nombre, rol: u.rol },
    padrinos: visibles.map(publicoP_),
    referidos: referidos.filter(r => ids.indexOf(String(r.padrino_id)) > -1 || ve(r.asesor)).map(publicoP_),
    personal: personal.filter(p => String(p.estado) === 'Activo').map(p => ({ nombre: p.nombre, rol: p.rol })),
    sistemas: SISTEMAS_PLAN, servidor: new Date().toISOString()
  };
}

function padrinosGuardar_(body, u) {
  const d = body.data || {}, sup = esSupervision_(u);
  const sh = hojaPadrinos_(), todos = leerP_(sh, COL_PADRINOS);
  const nombre = txtP_(d.nombre), tel = telP_(d.telefono);
  if (!nombre) return { ok: false, error: 'falta_nombre' };
  if (tel.length < 8) return { ok: false, error: 'falta_telefono' };
  const asesor = txtP_(d.asesor) || u.nombre;
  if (!sup && asesor !== u.nombre) return { ok: false, error: 'sin_permiso' };
  let p = d.id ? todos.find(x => String(x.id) === String(d.id)) : null;
  if (d.id && !p) return { ok: false, error: 'no_encontrado' };
  if (p && !sup && p.asesor !== u.nombre) return { ok: false, error: 'sin_permiso' };
  const dup = todos.find(x => telP_(x.telefono) === tel && (!p || String(x.id) !== String(p.id)) && x.estado !== 'baja');
  if (dup) return { ok: false, error: 'padrino_existe', detalle: dup.nombre + ' · ' + dup.codigo };
  const nuevo = !p;
  if (nuevo) p = { id: 'P' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), codigo: nuevoCodigoPadrino_(todos.map(x => x.codigo)), alta: hoyP_(), estado: 'activo', cuotas_al_dia: 0, retiro: '', resena: '', _fila: -1 };
  Object.assign(p, { nombre: nombre, telefono: tel, cumple: txtP_(d.cumple), nro_contrato: txtP_(d.nro_contrato), asesor: asesor, notas: txtP_(d.notas).slice(0, 500) });
  // Lo que suma puntos lo carga supervisión
  if (sup) {
    if (d.cuotas_al_dia !== undefined) p.cuotas_al_dia = Math.max(0, Math.min(300, parseInt(d.cuotas_al_dia, 10) || 0));
    if (d.retiro !== undefined) { const r = d.retiro === true || d.retiro === 'si'; if (r && p.retiro !== 'si') p.fecha_retiro = hoyP_(); if (!r) p.fecha_retiro = ''; p.retiro = r ? 'si' : ''; }
    if (d.resena !== undefined) p.resena = (d.resena === true || d.resena === 'si') ? 'si' : '';
    if (d.estado === 'baja' || d.estado === 'activo') p.estado = d.estado;
  }
  escribirP_(sh, COL_PADRINOS, p._fila, p);
  logP_(u, nuevo ? 'alta_padrino' : 'edicion_padrino', p.codigo + ' · ' + p.nombre);
  return { ok: true, padrino: publicoP_(p) };
}

function referidosGuardar_(body, u, avisos) {
  const d = body.data || {};
  const padrinos = leerP_(hojaPadrinos_(), COL_PADRINOS);
  const pad = padrinos.find(x => String(x.id) === String(d.padrino_id));
  if (!pad || pad.estado === 'baja') return { ok: false, error: 'padrino_invalido' };
  const cliente = txtP_(d.cliente), tel = telP_(d.telefono);
  if (!cliente) return { ok: false, error: 'falta_nombre' };
  if (tel.length < 8) return { ok: false, error: 'falta_telefono' };
  if (tel === telP_(pad.telefono)) return { ok: false, error: 'autorreferido' };
  const asesor = txtP_(d.asesor) || pad.asesor || u.nombre;
  if (!esSupervision_(u) && asesor !== u.nombre) return { ok: false, error: 'sin_permiso' };
  const sistema = SISTEMAS_PLAN.indexOf(d.sistema) > -1 ? d.sistema : '';
  const shR = hojaReferidos_(), refs = leerP_(shR, COL_REFERIDOS);
  // Un referido, un padrino: el primero que lo trae
  const ya = refs.find(r => telP_(r.telefono) === tel && r.estado !== 'baja');
  if (ya) return { ok: false, error: 'referido_existe', detalle: ya.cliente + ' (padrino ' + ya.padrino_codigo + ')' };
  // Si ya estaba cargado como lead en el CRM, no suma (regla de duplicados)
  const leadPrevio = leerHoja_(HOJAS.leads).find(l => telP_(l.telefono) === tel);
  if (leadPrevio) return { ok: false, error: 'lead_existe', detalle: leadPrevio.cliente + ' · ' + (leadPrevio.asignado_a || '') };
  // 1) Lead en el CRM
  const shL = obtenerHoja_(HOJAS.leads), hL = asegurarColumnas_(shL, COLUMNAS[HOJAS.leads]);
  const lead = { id: String(Date.now()), cliente: cliente, telefono: tel, interes: txtP_(d.interes) || (sistema ? 'Plan ' + sistema : ''), origen: 'Referido',
    asignado_a: asesor, fecha_asignacion: hoyP_(), hora_limite: '', estado: 'pendiente', resultado: '', hora_contacto: '',
    notas: ('Referido por ' + pad.nombre + ' (padrino ' + pad.codigo + ')' + (d.notas ? ' · ' + txtP_(d.notas) : '')).slice(0, 500) };
  shL.appendRow(hL.map(h => valorParaCelda_(h, h === 'actualizado' ? new Date() : lead[h])));
  if (asesor !== u.nombre) avisos.push(() => avisarLeadAsignado_(lead, u));
  // 2) Referido
  const r = { id: 'R' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), padrino_id: pad.id, padrino_codigo: pad.codigo, cliente: cliente, telefono: tel,
    interes: txtP_(d.interes), sistema: sistema, asesor: asesor, estado: 'camino', nro_contrato: '', lead_id: lead.id, alta: hoyP_(), notas: txtP_(d.notas).slice(0, 500) };
  escribirP_(shR, COL_REFERIDOS, -1, r);
  logP_(u, 'alta_referido', cliente + ' → padrino ' + pad.codigo);
  return { ok: true, referido: r, lead_id: lead.id };
}

function referidosEstado_(body, u) {
  const sh = hojaReferidos_(), refs = leerP_(sh, COL_REFERIDOS);
  const r = refs.find(x => String(x.id) === String(body.id));
  if (!r) return { ok: false, error: 'no_encontrado' };
  const nuevo = String(body.estado || ''), sup = esSupervision_(u);
  if (ESTADOS_REFERIDO.indexOf(nuevo) < 0 && nuevo !== 'baja') return { ok: false, error: 'estado_invalido' };
  if (ESTADOS_SOLO_SUPERVISION.indexOf(nuevo) > -1 && !sup) return { ok: false, error: 'solo_supervision' };
  if (!sup && r.asesor !== u.nombre) return { ok: false, error: 'sin_permiso' };
  if (r.estado === 'baja') return { ok: false, error: 'referido_baja' };
  if (nuevo !== 'baja') {
    const iA = ESTADOS_REFERIDO.indexOf(r.estado), iN = ESTADOS_REFERIDO.indexOf(nuevo);
    if (iN !== iA + 1 && !(sup && body.corregir)) return { ok: false, error: 'orden_invalido' }; // se avanza de a un paso
  } else if (ESTADOS_REFERIDO.indexOf(r.estado) >= 3) return { ok: false, error: 'baja_tarde' }; // pasada la cuota 3 los puntos ya están ganados
  if (body.sistema && SISTEMAS_PLAN.indexOf(body.sistema) > -1) r.sistema = body.sistema;
  if (body.nro_contrato) r.nro_contrato = txtP_(body.nro_contrato).slice(0, 20);
  if (nuevo === 'firmo' && !r.sistema) return { ok: false, error: 'falta_sistema' };
  const campoFecha = { entrevista: 'fecha_entrevista', firmo: 'fecha_firma', cuota3: 'fecha_cuota3', retiro: 'fecha_retiro', baja: 'fecha_baja' }[nuevo];
  const antes = r.estado;
  r.estado = nuevo; if (campoFecha) r[campoFecha] = hoyP_();
  escribirP_(sh, COL_REFERIDOS, r._fila, r);
  logP_(u, 'estado_referido', r.cliente + ': ' + antes + ' → ' + nuevo + (r.nro_contrato ? ' · contrato ' + r.nro_contrato : ''));
  return { ok: true, referido: publicoP_(r) };
}
