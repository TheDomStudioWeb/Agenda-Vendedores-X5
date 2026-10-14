/**
 * X5 Cuyo · Radar de Usados — Buscador de compra
 * Busca un modelo en sitios públicos de compraventa (DeRuedas y Autocosmos) y devuelve los autos encontrados.
 *
 * Instalación (una sola vez):
 *  1. script.google.com → Nuevo proyecto → pegar este archivo completo.
 *  2. Implementar → Nueva implementación → Tipo: Aplicación web.
 *     Ejecutar como: Yo · Quién tiene acceso: Cualquier persona → Implementar → Autorizar.
 *  3. Copiar la URL que termina en /exec y pegarla en el Radar (pestaña Compra → Conectar buscador).
 *
 * Uso: .../exec?marca=Volkswagen&modelo=Gol Trend&provincia=Mendoza&desde=2014&hasta=2016
 */

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
var DR_PROV = { 'mendoza': 1, 'buenos aires': 2, 'cordoba': 6, 'san juan': 17, 'san luis': 18 };
var AC_PROV = {
  'buenos aires': 301, 'catamarca': 302, 'chaco': 303, 'chubut': 304, 'cordoba': 305, 'corrientes': 306, 'entre rios': 307,
  'formosa': 308, 'jujuy': 309, 'la pampa': 310, 'la rioja': 311, 'mendoza': 312, 'misiones': 313, 'neuquen': 314,
  'rio negro': 315, 'salta': 316, 'san juan': 317, 'san luis': 318, 'santa cruz': 319, 'santa fe': 320,
  'santiago del estero': 321, 'tierra del fuego': 322, 'tucuman': 323, 'caba': 324, 'amba': 374
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  var q = {
    marca: limpiarNombre_(p.marca), modelo: limpiarNombre_(p.modelo),
    provincia: sinTildes_(String(p.provincia || '').toLowerCase().trim()),
    desde: parseInt(p.desde, 10) || 0, hasta: parseInt(p.hasta, 10) || 0
  };
  if (!q.marca || !q.modelo) return json_({ ok: false, error: 'Falta marca o modelo' });
  var clave = 'b:' + [q.marca, q.modelo, q.provincia, q.desde, q.hasta].join('|').toLowerCase();
  var cache = CacheService.getScriptCache();
  var guardado = cache.get(clave);
  if (guardado && !p.fresco) return ContentService.createTextOutput(guardado).setMimeType(ContentService.MimeType.JSON);
  var r = buscar_(q, descargar_);
  var txt = JSON.stringify(r);
  if (txt.length < 95000) cache.put(clave, txt, 1800);
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}

/** Descarga varias URLs en paralelo. Devuelve [{codigo, texto}] en el mismo orden. */
function descargar_(urls) {
  var pedidos = urls.map(function (u) { return { url: u, muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': UA, 'Accept-Language': 'es-AR,es;q=0.9' } }; });
  return UrlFetchApp.fetchAll(pedidos).map(function (res) { return { codigo: res.getResponseCode(), texto: res.getContentText() }; });
}

/** Arma las URLs, descarga, lee y filtra. `bajar` permite probar el buscador fuera de Apps Script. */
function buscar_(q, bajar) {
  var fuentes = [];
  var dr = urlsDeRuedas_(q), ac = urlsAutocosmos_(q);
  var res = bajar(dr.concat(ac));
  var autos = [];
  var r1 = leerFuente_('deruedas', 'DeRuedas', dr, res.slice(0, dr.length), parsearDeRuedas_);
  var r2 = leerFuente_('autocosmos', 'Autocosmos', ac, res.slice(dr.length), parsearAutocosmos_);
  [r1, r2].forEach(function (r) { fuentes.push(r.fuente); autos = autos.concat(r.autos); });

  var mod = normalizar_(q.modelo), vistos = {};
  autos = autos.filter(function (a) {
    if (vistos[a.id]) return false; vistos[a.id] = true;
    var m = normalizar_(a.modelo);
    if (!(m === mod || m.indexOf(mod + ' ') === 0)) return false;
    if (q.desde && a.anio && a.anio < q.desde) return false;
    if (q.hasta && a.anio && a.anio > q.hasta) return false;
    if (q.provincia && a.provincia && normalizar_(a.provincia).indexOf(normalizar_(q.provincia)) < 0 &&
        !(q.provincia === 'buenos aires' && /buenos aires|caba|amba/i.test(sinTildes_(a.provincia)))) return false;
    return true;
  });
  return { ok: true, consulta: q, fuentes: fuentes, autos: autos, generado: new Date().toISOString() };
}

function leerFuente_(id, nombre, urls, respuestas, parser) {
  var autos = [], errores = [];
  respuestas.forEach(function (r, i) {
    if (r.codigo !== 200) { errores.push('HTTP ' + r.codigo); return; }
    try { autos = autos.concat(parser(r.texto)); } catch (err) { errores.push(String(err)); }
  });
  return { fuente: { id: id, nombre: nombre, encontrados: autos.length, errores: errores, consultas: urls.length }, autos: autos };
}

/* ── DeRuedas ── Cuyo y Córdoba. Autos (segmento 0) y camionetas (segmento 1) van separados. */
function urlsDeRuedas_(q) {
  var prov = DR_PROV[q.provincia];
  if (q.provincia && !prov) return []; // DeRuedas no cubre esa provincia
  var base = 'https://www.deruedas.com.ar/busCraw.asp?weNeed=divBusqueda&pag=1&mostrarRegistros=90' +
    '&marca=' + encodeURIComponent(q.marca) + '&modelo=' + encodeURIComponent(q.marca + ':' + q.modelo) +
    (prov ? '&provincia=' + prov : '') + (q.desde ? '&anio_1=' + q.desde : '') + (q.hasta ? '&anio_2=' + q.hasta : '');
  return [base + '&segmento=0', base + '&segmento=1'];
}

function parsearDeRuedas_(html) {
  var out = [], partes = html.split('<div id="car_');
  for (var i = 1; i < partes.length; i++) {
    var b = partes[i];
    if (b.indexOf('schema.org/Car') < 0) continue;
    var id = b.match(/^(\d+)/);
    var prop = function (n) { var m = b.match(new RegExp('itemprop="' + n + '" content="([^"]*)"')); return m ? texto_(m[1]) : ''; };
    var url = b.match(/itemprop="url" href="([^"]+)"/);
    var foto = b.match(/itemprop="image"[^>]*src="([^"]+)"/);
    var version = b.match(/versionLink"[^>]*>([^<]*)</);
    var lugar = b.match(/Km<br>\s*([^<]+?)\s*</) || b.match(/<span class="texto"[^>]*>\s*(?:\d+\s*Km<br>)?\s*([A-ZÁÉÍÓÚ][^<|]+,[^<]+?)\s*</);
    var lp = lugar ? texto_(lugar[1]).split(',') : [];
    var km = parseInt(prop('mileageFromOdometer').replace(/\D/g, ''), 10);
    out.push({
      fuente: 'deruedas', id: 'dr-' + (id ? id[1] : i), marca: prop('brand'), modelo: prop('model'),
      version: version ? texto_(version[1]) : '', anio: parseInt(prop('vehicleModelDate'), 10) || null,
      km: isFinite(km) ? km : null, combustible: prop('fuelType'),
      precio: parseFloat(prop('price')) || null, moneda: prop('priceCurrency') || 'ARS',
      provincia: (lp[0] || '').trim(), localidad: (lp[1] || '').trim(),
      foto: foto ? foto[1] : '', url: url ? 'https://www.deruedas.com.ar' + url[1] : '',
      vendedor: /LOGO CLIENTE[\s\S]{0,400}<img/.test(b) ? 'Agencia' : ''
    });
  }
  return out;
}

/* ── Autocosmos ── todo el país, hasta 3 páginas. */
function urlsAutocosmos_(q) {
  var prov = AC_PROV[q.provincia];
  var base = 'https://www.autocosmos.com.ar/auto/usado/' + slug_(q.marca) + '/' + slug_(q.modelo) + '?';
  var params = [];
  if (prov) params.push('pr=' + prov);
  if (q.desde && q.desde === q.hasta) params.push('a=' + q.desde);
  var urls = [];
  for (var p = 1; p <= 3; p++) urls.push(base + params.concat(p > 1 ? ['pidx=' + p] : []).join('&'));
  return urls;
}

function parsearAutocosmos_(html) {
  var out = [], partes = html.split('<article class="card listing-card');
  for (var i = 1; i < partes.length; i++) {
    var b = partes[i].split('</article>')[0];
    var cls = function (c) { var m = b.match(new RegExp('class="listing-card__' + c + '[^"]*"[^>]*>([^<]*)<')); return m ? texto_(m[1]) : ''; };
    var url = b.match(/itemprop="url" href="([^"]+)"/);
    var foto = b.match(/<img itemprop="image" content="([^"]+)"/);
    var precio = b.match(/itemprop="price" content="([\d.]+)"/);
    var moneda = b.match(/itemprop="priceCurrency" content="([A-Z]+)"/);
    var km = b.match(/content="KMT (\d+)"/);
    var logo = b.match(/listing-card__logoimg[\s\S]*?alt="Logo ([^"]+)"/);
    out.push({
      fuente: 'autocosmos', id: 'ac-' + (url ? url[1].split('/').pop() : i),
      marca: cls('brand'), modelo: cls('model'), version: cls('version'),
      anio: parseInt(cls('year'), 10) || null, km: km ? parseInt(km[1], 10) : null, combustible: '',
      precio: precio ? parseFloat(precio[1]) : null, moneda: moneda ? moneda[1] : 'ARS',
      provincia: cls('province'), localidad: cls('city').replace(/\s*\|\s*$/, ''),
      foto: foto ? foto[1] : '', url: url ? 'https://www.autocosmos.com.ar' + url[1] : '',
      vendedor: logo ? texto_(logo[1]) : ''
    });
  }
  return out;
}

/* ── Utilidades ── */
function texto_(s) {
  return String(s || '').replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function sinTildes_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function normalizar_(s) { return sinTildes_(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function slug_(s) { return normalizar_(s).replace(/ /g, '-'); }
function limpiarNombre_(s) {
  return String(s || '').replace(/\s*pick\s*-?\s*up\s*$/i, '').trim()
    .toLowerCase().replace(/(^|[\s-])([a-záéíóúñ])/g, function (m, a, b) { return a + b.toUpperCase(); });
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
