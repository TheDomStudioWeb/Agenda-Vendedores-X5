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

const HOJAS = {
  agenda: 'Hoja 1',
  leads: 'Leads',
  personal: 'Personal',
  flota: 'Flota'
};

// Columnas esperadas (se crean si faltan, en este orden al final de la hoja)
const COLUMNAS = {
  'Hoja 1': ['id', 'cliente', 'vehiculo', 'asesor', 'fecha', 'hora', 'estado', 'resultado', 'notas', 'lugar', 'auto_usado', 'nro_contrato', 'monto', 'actualizado', 'aviso_venta'],
  'Leads': ['id', 'cliente', 'telefono', 'interes', 'origen', 'asignado_a', 'fecha_asignacion', 'hora_limite', 'estado', 'resultado', 'hora_contacto', 'notas', 'actualizado', 'aviso_vencido']
};

// Campos que se guardan como texto (con apóstrofo) para que Sheets no los convierta
const CAMPOS_TEXTO = ['telefono', 'fecha', 'hora', 'fecha_asignacion', 'hora_limite', 'hora_contacto', 'nro_contrato'];
// Campos que el cliente nunca puede pisar
const CAMPOS_PROTEGIDOS = ['id', 'actualizado', 'aviso_venta', 'aviso_vencido'];
// Campos con fecha y hora completas (el resto de las fechas se leen como día)
const CAMPOS_MARCA_TIEMPO = ['actualizado', 'aviso_venta', 'aviso_vencido'];
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

    // Lectura de datos y enlace de Telegram (la sesión viaja en el cuerpo, no en la dirección)
    if (body.action === 'datos') { if (!usuario) return json_({ ok: false, error: 'sesion_vencida' }); return json_(armarDatos_(usuario)); }
    if (body.action === 'telegram_link') { if (!usuario) return json_({ ok: false, error: 'sesion_vencida' }); return json_(linkTelegram_(usuario.nombre)); }

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
      if (String(datos[i][iN]) === String(nombre)) { sheet.getRange(i + 1, iC + 1).setValue(valor); return; }
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
  const personal = personalLimpio_();
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
  if (usuario.rol === 'Gerente Comercial') return () => true;
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
  return data
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = normalizar_(row[i], tz, h); });
      return obj;
    });
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
    if (String(data[r][iN]) === nombre && String(data[r][iE]) === 'Activo') {
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
