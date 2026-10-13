/**
 * X5 Cuyo · Hub Comercial — Backend (Google Apps Script)
 * ------------------------------------------------------------------
 * Cambios respecto de la versión anterior:
 *  - Escribe y lee por NOMBRE DE ENCABEZADO, no por número de columna.
 *    Si falta una columna (ej. "notas" en Leads) la crea sola.
 *    => Corrige que las observaciones de los Leads se borraban.
 *  - Las claves del personal NUNCA salen del servidor.
 *  - Login validado en el servidor; devuelve un token firmado (30 días).
 *  - Cada usuario recibe solo la agenda y los leads que le corresponden.
 *  - Escrituras con LockService (evita filas pisadas si dos guardan a la vez).
 *  - Respuestas con { ok: true/false } para que la app sepa si se guardó.
 *
 * Despliegue: Implementar > Administrar implementaciones > editar la
 * implementación actual > Versión: "Nueva versión". Así la URL /exec
 * no cambia y la app sigue apuntando al mismo lugar.
 */

// ── Configuración ──────────────────────────────────────────────────
// true  = la lectura sin token sigue funcionando (sin claves) para no romper
//         integraciones viejas (ej. un widget). Pasalo a false cuando todo
//         use token o LAUNCHER_KEY.
const MODO_COMPATIBLE = true;
const DIAS_TOKEN = 30;
const ROLES_SUPERVISION = ['Gerente Comercial', 'Jefe de Ventas', 'Referente'];

const HOJAS = {
  agenda: 'Hoja 1',
  leads: 'Leads',
  personal: 'Personal',
  flota: 'Flota'
};

// Columnas esperadas (se crean si faltan, en este orden al final de la hoja)
const COLUMNAS = {
  'Hoja 1': ['id', 'cliente', 'vehiculo', 'asesor', 'fecha', 'hora', 'estado', 'resultado', 'notas', 'lugar', 'auto_usado', 'nro_contrato', 'monto', 'actualizado'],
  'Leads': ['id', 'cliente', 'telefono', 'interes', 'origen', 'asignado_a', 'fecha_asignacion', 'hora_limite', 'estado', 'resultado', 'hora_contacto', 'notas', 'actualizado']
};

// Campos que se guardan como texto (con apóstrofo) para que Sheets no los convierta
const CAMPOS_TEXTO = ['telefono', 'fecha', 'hora', 'fecha_asignacion', 'hora_limite', 'hora_contacto', 'nro_contrato'];
// Campos que el cliente nunca puede pisar
const CAMPOS_PROTEGIDOS = ['id', 'actualizado'];

// ── Entradas HTTP ──────────────────────────────────────────────────
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'usuarios') return json_({ ok: true, usuarios: listarUsuarios_() });

    // Clave de solo lectura para widgets (Propiedades del script > LAUNCHER_KEY)
    const launcherKey = PropertiesService.getScriptProperties().getProperty('LAUNCHER_KEY');
    if (p.key && launcherKey && p.key === launcherKey) return json_(armarDatos_(null));

    if (p.token) {
      const usuario = validarToken_(p.token);
      if (!usuario) return json_({ ok: false, error: 'sesion_vencida' });
      return json_(armarDatos_(usuario));
    }

    if (MODO_COMPATIBLE) return json_(armarDatos_(null));
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
    if (!usuario && !MODO_COMPATIBLE) return json_({ ok: false, error: 'sesion_vencida' });

    const nombreHoja = body.tabla || HOJAS.agenda;
    if (!COLUMNAS[nombreHoja]) return json_({ ok: false, error: 'tabla_invalida' });

    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sheet = obtenerHoja_(nombreHoja);
      const headers = asegurarColumnas_(sheet, COLUMNAS[nombreHoja]);
      const datos = body.data || body; // compatibilidad con el formato viejo

      if (body.action === 'add') {
        if (buscarFila_(sheet, datos.id) > 0) return json_({ ok: true, duplicado: true });
        const fila = headers.map(h => valorParaCelda_(h, h === 'actualizado' ? new Date() : datos[h]));
        sheet.appendRow(fila);
        return json_({ ok: true });
      }

      if (body.action === 'update') {
        const filaN = buscarFila_(sheet, datos.id);
        if (filaN < 0) return json_({ ok: false, error: 'no_encontrado' });
        const rango = sheet.getRange(filaN, 1, 1, headers.length);
        const actual = rango.getValues()[0];
        headers.forEach((h, i) => {
          if (CAMPOS_PROTEGIDOS.includes(h)) return;
          if (Object.prototype.hasOwnProperty.call(datos, h) && datos[h] !== undefined) {
            actual[i] = valorParaCelda_(h, datos[h]);
          }
        });
        const iAct = headers.indexOf('actualizado');
        if (iAct > -1) actual[iAct] = new Date();
        rango.setValues([actual]);
        return json_({ ok: true });
      }

      return json_({ ok: false, error: 'accion_invalida' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ── Login y tokens ────────────────────────────────────────────────
function login_(nombre, clave) {
  const persona = leerHoja_(HOJAS.personal).find(p => String(p.nombre) === String(nombre));
  if (!persona || String(persona.estado) !== 'Activo') return { ok: false, error: 'usuario_invalido' };
  if (String(persona.clave) !== String(clave)) return { ok: false, error: 'clave_incorrecta' };
  const exp = Date.now() + DIAS_TOKEN * 86400000;
  return { ok: true, token: firmarToken_(persona.nombre, exp), usuario: limpiarPersona_(persona) };
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
  const persona = leerHoja_(HOJAS.personal).find(p => String(p.nombre) === nombre);
  if (!persona || String(persona.estado) !== 'Activo') return null; // baja = sesión cortada
  return limpiarPersona_(persona);
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
  const personal = leerHoja_(HOJAS.personal).map(limpiarPersona_);
  let agenda = leerHoja_(HOJAS.agenda);
  let leads = leerHoja_(HOJAS.leads);
  const flota = leerHoja_(HOJAS.flota);

  if (usuario) {
    const puedeVer = visibilidad_(usuario, personal);
    agenda = agenda.filter(a => puedeVer(a.asesor));
    leads = leads.filter(l => puedeVer(l.asignado_a));
  }
  return { ok: true, agenda: agenda, leads: leads, personal: personal, flota: flota, usuario: usuario || undefined, servidor: new Date().toISOString() };
}

function visibilidad_(usuario, personal) {
  if (usuario.rol === 'Gerente Comercial') return () => true;
  const equipo = personal.filter(p => p.reporta_a === usuario.nombre).map(p => p.nombre);
  return nombre => nombre === usuario.nombre || equipo.includes(nombre);
}

function listarUsuarios_() {
  return leerHoja_(HOJAS.personal)
    .filter(p => String(p.estado) === 'Activo')
    .map(p => ({ nombre: p.nombre, rol: p.rol }));
}

function limpiarPersona_(p) {
  const copia = Object.assign({}, p);
  delete copia.clave;
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
      headers.forEach((h, i) => { if (h) obj[h] = normalizar_(row[i], tz); });
      return obj;
    });
}

// Fechas y horas de Sheets → texto estable ("2026-10-13", "14:30")
function normalizar_(v, tz) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
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
