/* =====================================================================
   Padrinos X5 — reglas y motor de puntos (compartido por padrinos.html y pase.html)
   Valores propuestos, en revisión con el directorio: cambiarlos acá cambia el cálculo en todos lados.
   ===================================================================== */
(function () {
  'use strict';
  const R = {
    entrevista: 10, firma: 100, cuota3: 50, retiroRef: 100, bienvenida: 20, racha: 30, rachaCada: 6, retiroPropio: 150, cumple: 50, resena: 20,
    mult: { '10 adelantos': 1, '5 adelantos': 1.5, 'Entrega programada': 2 },
    niveles: [{ n: 'Cliente X5', min: 0, x: 1 }, { n: 'Padrino', min: 1, x: 1 }, { n: 'Padrino Oro', min: 3, x: 1.25 }, { n: 'Embajador X5', min: 6, x: 1.5 }]
  };
  const PREMIOS = [
    { t: 'Voucher de Gangas Club', d: 'En un comercio aliado', p: 50 },
    { t: 'Lavado completo', d: 'Para quien ya retiró su vehículo', p: 80 },
    { t: 'Kit de seguridad', d: 'Matafuego, balizas y botiquín · quien ya retiró', p: 120 },
    { t: 'Bonificación en una cuota', d: 'Desde nivel Padrino', p: 150 },
    { t: 'Sellado bonificado', d: 'Si contrata otro plan', p: 200 },
    { t: 'Polarizado', d: 'Para quien ya retiró su vehículo', p: 250 }
  ];
  const EST = ['camino', 'entrevista', 'firmo', 'cuota3', 'retiro'];
  const EST_TXT = { camino: 'En camino', entrevista: 'Entrevista', firmo: 'Firmó', cuota3: 'Cuota 3', retiro: 'Retiró', baja: 'Baja' };

  const hoyISO = () => { const d = new Date(), z = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
  const fechaLarga = (iso) => { const s = String(iso || '').split('T')[0].split('-'); return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(iso || ''); };
  const fechaCorta = (iso) => { const s = String(iso || '').split('T')[0].split('-'); return s.length === 3 ? `${s[2]}/${s[1]}` : String(iso || ''); };
  function multNivel(k) { let x = 1; R.niveles.forEach(l => { if (k >= l.min) x = l.x; }); return x; }
  function cumplesDesde(alta, cumple) {
    if (!cumple || !/^\d{4}-\d{2}-\d{2}/.test(cumple)) return 0;
    const hoy = hoyISO(), md = cumple.slice(5, 10), a0 = Number((alta || hoy).slice(0, 4)), a1 = Number(hoy.slice(0, 4));
    let n = 0; for (let a = a0; a <= a1; a++) { const f = a + '-' + md; if (f >= (alta || hoy) && f <= hoy) n++; } return n;
  }
  /* p = padrino; referidos = todos los referidos disponibles (se filtran los suyos).
     Devuelve { refs (con _pts y _pend), ok (referidos con cuota 3), av, pe, own, li (índice de nivel) } */
  function calcular(p, referidos) {
    const refs = (referidos || []).filter(r => String(r.padrino_id) === String(p.id));
    const ok = refs.filter(r => EST.indexOf(r.estado) >= 3).sort((a, b) => String(a.fecha_cuota3 || a.alta).localeCompare(String(b.fecha_cuota3 || b.alta)));
    let av = 0, pe = 0;
    refs.forEach(r => {
      r._pts = 0; r._pend = 0; if (r.estado === 'baja') return;
      const i = EST.indexOf(r.estado), m = R.mult[r.sistema] || 1, k = ok.indexOf(r), L = multNivel(k >= 0 ? k : ok.length);
      if (i >= 1) r._pts += R.entrevista;
      if (i === 2) r._pend += Math.round(R.firma * m * L);
      if (i >= 3) r._pts += Math.round((R.firma + R.cuota3) * m * L);
      if (i >= 4) r._pts += R.retiroRef;
      av += r._pts; pe += r._pend;
    });
    const cuotas = Number(p.cuotas_al_dia) || 0, rachas = Math.floor(cuotas / R.rachaCada), nCum = cumplesDesde(p.alta, p.cumple);
    const own = [
      { t: 'Bienvenida', d: 'Alta el ' + fechaLarga(p.alta), v: R.bienvenida },
      { t: 'Cuotas al día', d: cuotas + ' seguidas · faltan ' + (R.rachaCada - cuotas % R.rachaCada) + ' para el próximo premio', v: rachas * R.racha },
      { t: 'Retiro del vehículo', d: p.retiro === 'si' ? 'Retirado el ' + fechaLarga(p.fecha_retiro) + ' · un nivel más' : 'Al retirar: +150 y un nivel más', v: p.retiro === 'si' ? R.retiroPropio : 0 },
      { t: 'Cumpleaños', d: p.cumple ? fechaCorta(p.cumple) : 'Sin fecha cargada', v: nCum * R.cumple },
      { t: 'Reseña en Google', d: p.resena === 'si' ? 'Cargada' : 'Con foto de la entrega', v: p.resena === 'si' ? R.resena : 0 }
    ];
    own.forEach(o => av += o.v);
    let li = 0; R.niveles.forEach((l, i) => { if (ok.length >= l.min) li = i; });
    if (p.retiro === 'si') li = Math.min(li + 1, R.niveles.length - 1);
    return { refs, ok: ok.length, av, pe, own, li };
  }
  window.Padrinos = { R, PREMIOS, EST, EST_TXT, calcular, multNivel, cumplesDesde };
})();
