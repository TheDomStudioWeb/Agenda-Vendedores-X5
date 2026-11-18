/* =====================================================================
   Padrinos X5 — reglas y motor de puntos (compartido por padrinos.html y pase.html)
   Valores propuestos, en revisión con el directorio: cambiarlos acá cambia el cálculo en todos lados.
   Los puntos se calculan a partir de movimientos con fecha:
   - Vencen a los 12 meses de ganados (los canjes consumen primero los más viejos).
   - En el mes del cumpleaños del padrino, lo que gana vale doble (salvo el regalo de cumpleaños).
   ===================================================================== */
(function () {
  'use strict';
  const R = {
    entrevista: 10, firma: 100, cuota3: 50, retiroRef: 100, bienvenida: 20, racha: 30, rachaCada: 6, retiroPropio: 150, cumple: 50, resena: 20,
    mult: { '10 adelantos': 1, '5 adelantos': 1.5, 'Entrega programada': 2 },
    niveles: [{ n: 'Cliente X5', min: 0, x: 1 }, { n: 'Padrino', min: 1, x: 1 }, { n: 'Padrino Oro', min: 3, x: 1.25 }, { n: 'Embajador X5', min: 6, x: 1.5 }],
    mesesVence: 12, avisoVenceDias: 30,
    canjesDesde: '2027-02-18'   // igual que CANJES_DESDE en Code.gs
  };
  // req: null (todos) · 'retiro' (ya retiró su vehículo) · 'padrino' (nivel Padrino o más)
  const PREMIOS = [
    { id: 'gangas', t: 'Voucher de Gangas Club', d: 'En un comercio aliado', p: 50, req: null },
    { id: 'lavado', t: 'Lavado completo', d: 'Para quien ya retiró su vehículo', p: 80, req: 'retiro' },
    { id: 'kit', t: 'Kit de seguridad', d: 'Matafuego, balizas y botiquín · quien ya retiró', p: 120, req: 'retiro' },
    { id: 'cuota', t: 'Bonificación en una cuota', d: 'Desde nivel Padrino', p: 150, req: 'padrino' },
    { id: 'sellado', t: 'Sellado bonificado', d: 'Si contrata otro plan', p: 200, req: null },
    { id: 'polarizado', t: 'Polarizado', d: 'Para quien ya retiró su vehículo', p: 250, req: 'retiro' }
  ];
  const EST = ['camino', 'entrevista', 'firmo', 'cuota3', 'retiro'];
  const EST_TXT = { camino: 'En camino', entrevista: 'Entrevista', firmo: 'Firmó', cuota3: 'Cuota 3', retiro: 'Retiró', baja: 'Baja' };
  const CANJE_TXT = { pendiente: 'Pedido · esperando aprobación', aprobado: 'Aprobado · coordiná la entrega con tu asesor', entregado: 'Entregado', rechazado: 'Rechazado · se devolvieron los puntos' };
  const CANJE_CUENTA = ['pendiente', 'aprobado', 'entregado'];

  const z = (x) => String(x).padStart(2, '0');
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
  const iso = (v) => String(v || '').split('T')[0];
  const fechaLarga = (v) => { const s = iso(v).split('-'); return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(v || ''); };
  const fechaCorta = (v) => { const s = iso(v).split('-'); return s.length === 3 ? `${s[2]}/${s[1]}` : String(v || ''); };
  const masMeses = (f, n) => { const [a, m, d] = iso(f).split('-').map(Number); const x = new Date(Date.UTC(a, m - 1 + n, d)); return x.toISOString().slice(0, 10); };
  const masDias = (f, n) => { const [a, m, d] = iso(f).split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
  function multNivel(k) { let x = 1; R.niveles.forEach(l => { if (k >= l.min) x = l.x; }); return x; }
  function cumples(alta, cumple, hoy) {
    if (!cumple || !/^\d{4}-\d{2}-\d{2}/.test(cumple)) return [];
    const md = cumple.slice(5, 10), desde = iso(alta) || hoy, out = [];
    for (let a = Number(desde.slice(0, 4)); a <= Number(hoy.slice(0, 4)); a++) { const f = a + '-' + md; if (f >= desde && f <= hoy) out.push(f); }
    return out;
  }

  /* p = padrino; referidos y canjes = listas completas (se filtran los suyos); hoy opcional (YYYY-MM-DD).
     Devuelve { refs (con _pts y _pend), ok, av, pe, own, li, ganados, canjeados, vencidos, porVencer {pts, fecha}, movimientos } */
  function calcular(p, referidos, canjes, hoy) {
    hoy = hoy || hoyISO();
    const mesCumple = p.cumple && /^\d{4}-\d{2}/.test(p.cumple) ? p.cumple.slice(5, 7) : '';
    const movs = [];
    const sumar = (fecha, pts, motivo, ref, sinDoble) => {
      fecha = iso(fecha) || iso(p.alta) || hoy;
      const doble = !sinDoble && mesCumple && fecha.slice(5, 7) === mesCumple;
      const m = { fecha, pts: doble ? pts * 2 : pts, motivo: motivo + (doble ? ' (doble por cumpleaños)' : ''), doble };
      movs.push(m); if (ref) ref._pts += m.pts; return m;
    };
    const refs = (referidos || []).filter(r => String(r.padrino_id) === String(p.id));
    const ok = refs.filter(r => EST.indexOf(r.estado) >= 3).sort((a, b) => String(a.fecha_cuota3 || a.alta).localeCompare(String(b.fecha_cuota3 || b.alta)));
    let pe = 0;
    refs.forEach(r => {
      r._pts = 0; r._pend = 0; if (r.estado === 'baja') return;
      const i = EST.indexOf(r.estado), m = R.mult[r.sistema] || 1, k = ok.indexOf(r), L = multNivel(k >= 0 ? k : ok.length);
      const nom = String(r.cliente || 'Referido').split(/\s+/)[0];
      if (i >= 1) sumar(r.fecha_entrevista || r.alta, R.entrevista, 'Entrevista de ' + nom, r);
      if (i === 2) r._pend += Math.round(R.firma * m * L);
      if (i >= 3) sumar(r.fecha_cuota3 || r.alta, Math.round((R.firma + R.cuota3) * m * L), 'Plan de ' + nom + ' (cuota 3)', r);
      if (i >= 4) sumar(r.fecha_retiro || r.alta, R.retiroRef, 'Retiro de ' + nom, r);
      pe += r._pend;
    });
    const cuotas = Number(p.cuotas_al_dia) || 0, rachas = Math.floor(cuotas / R.rachaCada);
    const own = [];
    const fila = (t, d, v, extra) => own.push(Object.assign({ t, d, v }, extra || {}));
    let m = sumar(p.alta, R.bienvenida, 'Bienvenida'); fila('Bienvenida', 'Alta el ' + fechaLarga(p.alta), m.pts);
    let vR = 0; if (rachas) { m = sumar(hoy, rachas * R.racha, 'Cuotas al día', null, true); vR = m.pts; }
    fila('Cuotas al día', cuotas + ' seguidas · faltan ' + (R.rachaCada - cuotas % R.rachaCada) + ' para el próximo premio', vR);
    let vRet = 0; if (p.retiro === 'si') { m = sumar(p.fecha_retiro || hoy, R.retiroPropio, 'Retiro del vehículo'); vRet = m.pts; }
    fila('Retiro del vehículo', p.retiro === 'si' ? 'Retirado el ' + fechaLarga(p.fecha_retiro) + ' · un nivel más' : 'Al retirar: +150 y un nivel más', vRet);
    const cs = cumples(p.alta, p.cumple, hoy); cs.forEach(f => sumar(f, R.cumple, 'Regalo de cumpleaños', null, true));
    fila('Cumpleaños', p.cumple ? fechaCorta(p.cumple) + (mesCumple ? ' · ese mes tus puntos valen doble' : '') : 'Sin fecha cargada', cs.length * R.cumple);
    let vRes = 0; if (p.resena === 'si') { m = sumar(p.fecha_resena || p.alta, R.resena, 'Reseña en Google'); vRes = m.pts; }
    fila('Reseña en Google', p.resena === 'si' ? 'Cargada' : 'Con foto de la entrega', vRes);

    // Canjes: los pedidos, aprobados y entregados descuentan; los rechazados no
    const susCanjes = (canjes || []).filter(c => String(c.padrino_id) === String(p.id));
    const canjeados = susCanjes.filter(c => CANJE_CUENTA.indexOf(c.estado) > -1).reduce((t, c) => t + (Number(c.puntos) || 0), 0);
    // Vencimiento: los canjes consumen primero los puntos más viejos; lo que queda y tiene más de 12 meses, vence
    const lotes = movs.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(x => ({ fecha: x.fecha, resto: x.pts }));
    let porConsumir = canjeados;
    lotes.forEach(l => { const u = Math.min(l.resto, porConsumir); l.resto -= u; porConsumir -= u; });
    let av = 0, vencidos = 0, pvPts = 0, pvFecha = '';
    const limiteAviso = masDias(hoy, R.avisoVenceDias);
    lotes.forEach(l => {
      if (!l.resto) return;
      const vence = masMeses(l.fecha, R.mesesVence);
      if (vence <= hoy) { vencidos += l.resto; return; }
      av += l.resto;
      if (vence <= limiteAviso) { pvPts += l.resto; if (!pvFecha || vence < pvFecha) pvFecha = vence; }
    });
    const ganados = movs.reduce((t, x) => t + x.pts, 0);
    let li = 0; R.niveles.forEach((l, i) => { if (ok.length >= l.min) li = i; });
    if (p.retiro === 'si') li = Math.min(li + 1, R.niveles.length - 1);
    return { refs, ok: ok.length, av: Math.max(0, av), pe, own, li, ganados, canjeados, vencidos, deficit: porConsumir, porVencer: { pts: pvPts, fecha: pvFecha }, movimientos: movs, canjes: susCanjes };
  }
  /* ¿Puede pedir este premio? Devuelve '' si puede, o el motivo */
  function motivoNoCanje(premio, c, p, desde, hoy) {
    hoy = hoy || hoyISO(); desde = desde || R.canjesDesde;
    if (hoy < desde) return 'Los canjes se habilitan el ' + fechaLarga(desde);
    if (premio.req === 'retiro' && p.retiro !== 'si') return 'Disponible cuando retires tu vehículo';
    if (premio.req === 'padrino' && c.li < 1) return 'Disponible desde nivel Padrino';
    if (c.av < premio.p) return 'Te faltan ' + (premio.p - c.av) + ' puntos';
    return '';
  }
  window.Padrinos = { R, PREMIOS, EST, EST_TXT, CANJE_TXT, calcular, motivoNoCanje, multNivel, fechaLarga, fechaCorta };
})();
