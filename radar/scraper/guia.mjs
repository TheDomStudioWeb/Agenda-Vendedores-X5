// Cruce de cada auto con una guía de precios (hoy CCA; mañana InfoAuto con el mismo formato).
const AUTO = /(\b\d{0,2}AT\d?\b|\bAT\d\b|CVT|\bAUT|TIPTRONIC|\bTIPT|DSG|TRONIC|\bTCT\b|MULTIDRIVE|\bEDC\b|\bDCT\b|\bAMT\b|AUTOMAT|RAPTOR|\bA\/T\b|E-TECH|HYBRID)/i;
const MARCAS = { 'VW': 'VOLKSWAGEN', 'MERCEDES-BENZ': 'MERCEDES BENZ', 'MERCEDES': 'MERCEDES BENZ', 'CITROËN': 'CITROEN', 'MINI': 'MINI COOPER' };
const norm = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const variantes = (m) => { const a = norm(m); return [...new Set([a, a.replace(/([A-Z])(\d)/g, '$1 $2'), a.replace(/(\d)([A-Z])/g, '$1 $2'), a.replace(/-/g, ' '), a.replace(/\s+/g, '')])]; };
const tokens = (s) => new Set(norm(s).replace(/(\d),(\d)/g, '$1.$2').split(/[^A-Z0-9\.]+/).filter(t => t.length > 1));

export function cruzar(auto, guia, anioActual = new Date().getFullYear()) {
  const marca = MARCAS[norm(auto.marca)] || norm(auto.marca);
  const modelos = guia.marcas[marca];
  if (!modelos || !auto.anio) return null;
  const vs = variantes(auto.modelo);
  const nombres = Object.keys(modelos).filter(n => vs.includes(norm(n)) || vs.some(v => norm(n).startsWith(v + ' ')));
  if (!nombres.length) return null;
  const col = auto.anio >= anioActual ? '0km' : String(auto.anio);
  let cands = nombres.flatMap(n => modelos[n].filter(([, p]) => p[col]).map(([ver, p]) => ({ modelo: n, version: ver, valor: p[col] })));
  if (!cands.length) return null;
  const esAuto = /autom/i.test(auto.caja || '');
  const porCaja = cands.filter(c => AUTO.test(c.version) === esAuto);
  if (porCaja.length) cands = porCaja;
  // Puntaje por palabras en común con la versión publicada
  const tv = tokens(`${auto.version} ${auto.combustible === 'Diesel' ? 'TD' : ''}`);
  for (const c of cands) { const t = tokens(c.version); c.puntos = [...tv].filter(x => t.has(x)).length; }
  const max = Math.max(...cands.map(c => c.puntos));
  const vals = cands.map(c => c.valor).sort((a, b) => a - b);
  const med = vals[Math.floor(vals.length / 2)];
  let mejor = null;
  if (max > 0) {
    const top = cands.filter(c => c.puntos === max).sort((a, b) => a.valor - b.valor);
    mejor = top[Math.floor(top.length / 2)];
  }
  return {
    min: vals[0], med, max: vals[vals.length - 1], n: vals.length,
    mejor: mejor && { version: `${mejor.modelo} ${mejor.version}`, valor: mejor.valor, coincidencias: max, empate: cands.filter(c => c.puntos === max).length },
    versiones: cands.sort((a, b) => a.valor - b.valor).map(c => [`${c.modelo} ${c.version}`, c.valor]),
  };
}

// Si la agencia no informa la marca, se busca el modelo en la guía (solo si aparece en una única marca).
export function marcaPorModelo(auto, guia) {
  const vs = variantes(auto.modelo);
  const marcas = Object.entries(guia.marcas).filter(([, mods]) => Object.keys(mods).some(n => vs.includes(norm(n)) || vs.some(v => norm(n).startsWith(v + ' ')))).map(([m]) => m);
  if (!marcas.length) return '';
  let elegida = marcas[0];
  if (marcas.length > 1) { // desempate por la versión publicada
    const puntos = (m) => cruzar({ ...auto, marca: m }, guia)?.mejor?.coincidencias || 0;
    const orden = marcas.map(m => [m, puntos(m)]).sort((a, b) => b[1] - a[1]);
    if (orden[0][1] === 0 || orden[0][1] === orden[1][1]) return '';
    elegida = orden[0][0];
  }
  const m = elegida.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return m.replace('Bmw', 'BMW').replace('Mercedes Benz', 'Mercedes-Benz');
}
