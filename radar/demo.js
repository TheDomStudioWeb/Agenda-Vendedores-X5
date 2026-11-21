/* Radar de Usados · modo demo (?demo=1).
   Todo lo que hay acá es inventado: agencias, autos, fotos, negociadores y clientes.
   Simula el backend de reservas (radar_*) en memoria para probar el flujo sin tocar el Hub real. */
(function () {
  window.RADAR_DEMO = true;
  const H = 3600e3, ahora = Date.now(), iso = (t) => new Date(t).toISOString();

  // ── Fotos dibujadas: auto con patente, cartel amarillo y logo de agencia (para probar el tapado) ──
  function foto(color, patente, cartel, logo, vista) {
    const lado = vista === 1;
    const auto = lado
      ? `<rect x="120" y="300" width="560" height="120" rx="40" fill="${color}"/><path d="M230 300 L300 220 L520 220 L600 300 Z" fill="${color}"/><path d="M250 298 L310 235 L400 235 L400 298 Z M415 298 L415 235 L510 235 L575 298 Z" fill="#9fc3d8" opacity=".85"/><circle cx="240" cy="425" r="52" fill="#1b1b1e"/><circle cx="240" cy="425" r="24" fill="#8a8a90"/><circle cx="570" cy="425" r="52" fill="#1b1b1e"/><circle cx="570" cy="425" r="24" fill="#8a8a90"/><rect x="650" y="345" width="34" height="18" rx="4" fill="#ffd27a"/>`
      : `<path d="M190 330 Q200 250 280 235 L520 235 Q600 250 610 330 Z" fill="${color}"/><rect x="170" y="320" width="460" height="130" rx="34" fill="${color}"/><path d="M230 318 Q245 262 300 255 L500 255 Q555 262 570 318 Z" fill="#9fc3d8" opacity=".85"/><rect x="190" y="350" width="80" height="30" rx="10" fill="#fff4cc"/><rect x="530" y="350" width="80" height="30" rx="10" fill="#fff4cc"/><rect x="300" y="355" width="200" height="34" rx="6" fill="#222" opacity=".55"/><rect x="190" y="450" width="70" height="40" rx="10" fill="#1b1b1e"/><rect x="540" y="450" width="70" height="40" rx="10" fill="#1b1b1e"/>`;
    const pat = lado ? '' : `<g><rect x="335" y="402" width="130" height="38" rx="5" fill="#fff" stroke="#222" stroke-width="2"/><rect x="335" y="402" width="130" height="9" fill="#1d4f9c"/><text x="400" y="434" font-family="Arial" font-weight="700" font-size="21" text-anchor="middle" fill="#111">${patente}</text></g>`;
    const car = cartel ? (lado
      ? `<g><rect x="430" y="240" width="76" height="50" fill="#ffd400" stroke="#111" stroke-width="2"/><text x="468" y="262" font-family="Arial" font-weight="900" font-size="15" text-anchor="middle">VENDO</text><text x="468" y="281" font-family="Arial" font-size="10" text-anchor="middle">261 555-0199</text></g>`
      : `<g><rect x="420" y="262" width="74" height="48" fill="#ffd400" stroke="#111" stroke-width="2"/><text x="457" y="283" font-family="Arial" font-weight="900" font-size="15" text-anchor="middle">VENDO</text><text x="457" y="301" font-family="Arial" font-size="10" text-anchor="middle">261 555-0199</text></g>`) : '';
    const lg = `<g><rect x="604" y="24" width="172" height="44" rx="8" fill="rgba(0,0,0,.55)"/><text x="690" y="53" font-family="Arial" font-weight="800" font-size="17" text-anchor="middle" fill="#fff">${logo}</text></g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd8e3"/><stop offset=".62" stop-color="#eef1f4"/><stop offset=".62" stop-color="#7d8288"/><stop offset="1" stop-color="#5b6066"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><rect x="0" y="120" width="800" height="250" fill="#b8c2cc" opacity=".35"/>${auto}${pat}${car}${lg}<text x="20" y="585" font-family="Arial" font-size="13" fill="#fff" opacity=".8">FOTO DE PRUEBA · DEMO</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  // Cajas de esas fotos (en proporción 0..1), igual que las guarda el editor
  const C_PAT = [0.412, 0.66, 0.176, 0.083], C_CAR_F = [0.518, 0.428, 0.107, 0.098], C_CAR_L = [0.53, 0.39, 0.11, 0.103], C_LOGO = [0.75, 0.035, 0.22, 0.08];

  const AGS = [
    { id: 'autosur', nombre: 'Autos del Sur (demo)', ciudad: 'Godoy Cruz', logo: 'AUTOS DEL SUR' },
    { id: 'cordillera', nombre: 'Cordillera Usados (demo)', ciudad: 'Maipú', logo: 'CORDILLERA' },
  ];
  const BASE = [
    ['autosur', 'Toyota', 'Etios', '1.5 XLS 5P', 2019, 68000, 'Nafta', 'Manual', 'Gris', 15900000, '#8d939b', 'AC 482 PL', 1],
    ['autosur', 'Volkswagen', 'Amarok', '2.0 TDI Highline 4x4', 2018, 121000, 'Diésel', 'Automática', 'Blanca', 27500000, '#eceff2', 'AD 771 KQ', 1],
    ['autosur', 'Fiat', 'Cronos', '1.3 Drive', 2021, 41000, 'Nafta', 'Manual', 'Roja', 16800000, '#b3262f', 'AE 115 RT', 0],
    ['cordillera', 'Chevrolet', 'Onix', '1.0T LTZ', 2022, 30500, 'Nafta', 'Automática', 'Azul', 19900000, '#28508f', 'AF 203 MX', 1],
    ['cordillera', 'Renault', 'Duster', '1.6 Intens', 2020, 74000, 'Nafta', 'Manual', 'Naranja', 18500000, '#d96a1c', 'AE 590 BB', 1],
    ['cordillera', 'Ford', 'Ranger', '3.2 XLT 4x4', 2017, 148000, 'Diésel', 'Automática', 'Negra', 25200000, '#2a2b30', 'AB 934 GH', 0],
    ['cordillera', 'Peugeot', '208', '1.6 Allure', 2023, 12000, 'Nafta', 'Automática', 'Blanca', 24300000, '#f2f2f2', 'AG 017 CD', 1],
  ];
  const autos = BASE.map(([ag, marca, modelo, version, anio, km, comb, caja, color, precio, hex, pat, car], i) => {
    const logo = AGS.find(a => a.id === ag).logo;
    const ref = Math.round(precio * (0.92 + (i % 3) * 0.05) / 1e5) * 1e5;
    return { id: `demo-${ag}-${i + 1}`, agencia: ag, tipo: 'auto', marca, modelo, version, anio, km, combustible: comb, caja, color, precio, moneda: 'ARS',
      fotos: [foto(hex, pat, car, logo, 0), foto(hex, pat, car, logo, 1)], url: '', alta: iso(ahora - (i + 1) * 864e5 * 2), sucursal: AGS.find(a => a.id === ag).ciudad,
      guia: { mejor: { version: `${version} (demo)`, valor: ref }, min: ref * 0.9, max: ref * 1.1, n: 4 } };
  });
  const stock = {
    generado: iso(ahora), demo: true,
    agencias: AGS.map(a => ({ id: a.id, nombre: a.nombre, ciudad: a.ciudad, estado: 'ok', autos: autos.filter(x => x.agencia === a.id).length, actualizado: iso(ahora - 2 * H) })),
    autos, guia: { fuente: 'CCA (demo)' },
  };

  // ── Backend simulado ──
  const USUARIOS = {
    lucia: { nombre: 'Lucía Demo', rol: 'Negociador' },
    martin: { nombre: 'Martín Demo', rol: 'Negociador' },
    beto: { nombre: 'Beto Demo', rol: 'Asesor' },
    carla: { nombre: 'Carla Demo', rol: 'Jefe de Ventas' },
    gerencia: { nombre: 'Gerencia Demo', rol: 'Gerente Comercial' },
    direccion: { nombre: 'Dirección Demo', rol: 'Director Comercial General' },
  };
  let yo = 'lucia';
  try { yo = sessionStorage.getItem('radar-demo-yo') || yo; } catch (e) {}
  const HORAS = 48;
  const auto = (id) => autos.find(a => a.id === id) || {};
  const desc = (a) => `${a.marca} ${a.modelo} ${a.version} ${a.anio}`;
  const B = {
    reservas: [
      { id: 'r1', auto_id: 'demo-autosur-2', auto: desc(auto('demo-autosur-2')), agencia: 'autosur', negociador: 'Martín Demo', cliente: 'Juan Pérez (inventado)', telefono: '261 555-0101', notas: 'Seña a confirmar', estado: 'Activa', creada: iso(ahora - 5 * H), vence: iso(ahora + 43 * H), extendida: 0, proveedor_aviso: '' },
      { id: 'r2', auto_id: 'demo-cordillera-6', auto: desc(auto('demo-cordillera-6')), agencia: 'cordillera', negociador: 'Lucía Demo', cliente: 'Ana Gómez (inventada)', telefono: '261 555-0102', notas: '', estado: 'Activa', creada: iso(ahora - 30 * H), vence: iso(ahora + 18 * H), extendida: 0, proveedor_aviso: iso(ahora - 29 * H) },
      { id: 'r3', auto_id: 'demo-cordillera-4', auto: desc(auto('demo-cordillera-4')), agencia: 'cordillera', negociador: 'Carla Demo', cliente: 'Pedro Ruiz (inventado)', telefono: '', notas: '', estado: 'Vendida', creada: iso(ahora - 70 * H), vence: iso(ahora - 22 * H), extendida: 0, proveedor_aviso: iso(ahora - 69 * H), cerrada: iso(ahora - 26 * H) },
    ],
    retoques: {},
    provs: { autosur: { id: 'autosur', nombre: 'Autos del Sur (demo)', whatsapp: '2615550199', contacto: 'Roberto (inventado)' }, cordillera: { id: 'cordillera', nombre: 'Cordillera Usados (demo)', whatsapp: '', contacto: '' } },
  };
  // Logos de las agencias: marcados a mano una vez, para todas sus fotos (se desenfocan).
  B.retoques['prov:autosur'] = [C_LOGO]; B.retoques['prov:cordillera'] = [C_LOGO];
  // Patentes y carteles: los marca solo el lector del stock (stock.json → cubrir), igual que en el Radar real.
  // A propósito, «se le escapó» la patente de la Ford Ranger, para probar la corrección a mano.
  stock.cubrir = {};
  autos.forEach((a, i) => {
    const f = (a.modelo === 'Ranger' ? [] : [C_PAT.concat('pat')]).concat(BASE[i][12] ? [C_CAR_F.concat('cartel')] : []);
    if (f.length) stock.cubrir[a.fotos[0]] = f;
    if (BASE[i][12]) stock.cubrir[a.fotos[1]] = [C_CAR_L.concat('cartel')];
  });
  const propio = [
    { id: 'propio-1', propio: true, agencia: 'propio', tipo: 'auto', marca: 'Toyota', modelo: 'Hilux', version: '2.8 SRX 4x4 AT', anio: 2021, km: 58000, combustible: 'Diésel', caja: 'Automática', color: 'Plata', precio: 39900000, moneda: 'ARS',
      fotos: [foto('#b9bec4', 'AE 300 XX', 0, 'X5 ARGENTINA', 0), foto('#b9bec4', '', 0, 'X5 ARGENTINA', 1)], estado: 'Disponible', ubicacion: 'Salón X5 Mendoza (demo)', alta: iso(ahora - 864e5) },
  ];

  const sup = (u) => ['Gerente Comercial', 'Jefe de Ventas', 'Referente', 'Director Comercial General'].includes(u.rol);
  const reserva = (u) => ['Director Comercial General', 'Gerente Comercial', 'Negociador'].includes(u.rol);
  const activa = (r) => r.estado === 'Activa' && Date.parse(r.vence) > Date.now();
  function datos() {
    const u = USUARIOS[yo], s = sup(u);
    return { ok: true, usuario: u, supervisa: s, gerente: u.rol === 'Gerente Comercial', reserva: reserva(u), horas: HORAS,
      reservas: B.reservas.filter(r => activa(r) || r.estado === 'Vendida').map(r => { const mia = r.negociador === u.nombre;
        const x = { id: r.id, auto_id: r.auto_id, auto: r.auto, estado: r.estado, negociador: r.negociador, vence: r.vence, creada: r.creada, mia, proveedor_aviso: r.proveedor_aviso, puedeCerrar: mia || s };
        if (mia || s) Object.assign(x, { cliente: r.cliente, telefono: r.telefono, notas: r.notas, agencia: r.agencia, url: r.url, extendida: r.extendida });
        return x; }),
      retoques: JSON.parse(JSON.stringify(B.retoques)),
      proveedores: Object.values(B.provs).map(p => s ? Object.assign({}, p) : { id: p.id, nombre: p.nombre }), propio, servidor: iso(Date.now()) };
  }
  window.radarDemoPost = async function (b) {
    await new Promise(r => setTimeout(r, 250));
    const u = USUARIOS[yo], s = sup(u), r = b.id && B.reservas.find(x => x.id === b.id);
    switch (b.action) {
      case 'radar_datos': return datos();
      case 'radar_reservar': {
        if (!reserva(u)) return { ok: false, error: 'sin_permiso_reserva' };
        if (!b.cliente) return { ok: false, error: 'falta_cliente' };
        const ex = B.reservas.find(x => x.auto_id === b.auto.id && (activa(x) || x.estado === 'Vendida'));
        if (ex) return { ok: false, error: ex.estado === 'Vendida' ? 'ya_vendido' : 'ya_reservado' };
        B.reservas.push({ id: 'r' + Date.now(), auto_id: b.auto.id, auto: b.auto.desc, agencia: b.auto.agencia, url: b.auto.url, negociador: u.nombre, cliente: b.cliente, telefono: b.telefono, notas: b.notas,
          estado: 'Activa', creada: iso(Date.now()), vence: iso(Date.now() + HORAS * H), extendida: 0, proveedor_aviso: '' });
        aviso(`🔒 Nueva reserva de ${u.nombre}: ${b.auto.desc}. En el Hub real llega este aviso por Telegram a gerencia y al jefe, con el botón para avisar a la agencia por WhatsApp.`);
        return { ok: true };
      }
      case 'radar_liberar': case 'radar_vendida':
        if (!r) return { ok: false, error: 'no_encontrado' };
        if (r.negociador !== u.nombre && !s) return { ok: false, error: 'sin_permiso' };
        r.estado = b.action === 'radar_vendida' ? 'Vendida' : 'Liberada'; r.cerrada = iso(Date.now());
        aviso(b.action === 'radar_vendida' ? '✅ Vendida: gerencia recibe el aviso para dar de baja la unidad en la agencia.' : '🔓 Liberada: gerencia recibe el aviso para que la agencia la vuelva a ofrecer.');
        return { ok: true };
      case 'radar_extender':
        if (!r) return { ok: false, error: 'no_encontrado' };
        if (r.negociador !== u.nombre && !s) return { ok: false, error: 'sin_permiso' };
        if (r.extendida && !s) return { ok: false, error: 'ya_extendida' };
        r.vence = iso(Date.parse(r.vence) + HORAS * H); r.extendida++; return { ok: true, vence: r.vence };
      case 'radar_aviso_proveedor': if (!s) return { ok: false, error: 'sin_permiso' }; if (r) r.proveedor_aviso = iso(Date.now()); return { ok: true };
      case 'radar_retoque': if (!s) return { ok: false, error: 'sin_permiso' }; B.retoques[b.foto] = b.cajas; return { ok: true, cajas: b.cajas };
      case 'radar_proveedor_guardar': if (u.rol !== 'Gerente Comercial') return { ok: false, error: 'sin_permiso' }; B.provs[b.proveedor.id] = Object.assign({}, b.proveedor); return { ok: true };
    }
    return { ok: false, error: 'accion_invalida' };
  };
  function aviso(t) {
    const el = document.createElement('div');
    el.textContent = t;
    Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 9999, maxWidth: '92vw', background: '#161618', color: '#fff', border: '1px solid #f5c518', borderRadius: '12px', padding: '10px 14px', font: '600 .8rem Montserrat, sans-serif', boxShadow: '0 8px 30px rgba(0,0,0,.4)' });
    document.body.appendChild(el); setTimeout(() => el.remove(), 5200);
  }

  // El stock de prueba reemplaza la lectura de data/stock.json
  const fetchReal = window.fetch.bind(window);
  window.fetch = (u, o) => /data\/stock\.json/.test(String(u)) ? Promise.resolve(new Response(JSON.stringify(stock), { headers: { 'Content-Type': 'application/json' } }))
    : /data\/novedades\.json/.test(String(u)) ? Promise.resolve(new Response(JSON.stringify({ eventos: [] })))
    : fetchReal(u, o);

  // Barra de demo: elegir con qué usuario inventado probar
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.className = 'demo-banner';
    bar.innerHTML = `MODO DEMO · datos inventados, nada se guarda en el Hub · Probar como
      <select aria-label="Usuario de prueba">${Object.entries(USUARIOS).map(([k, v]) => `<option value="${k}"${k === yo ? ' selected' : ''}>${v.nombre} · ${v.rol}</option>`).join('')}</select>`;
    document.body.prepend(bar);
    bar.querySelector('select').onchange = (e) => { yo = e.target.value; try { sessionStorage.setItem('radar-demo-yo', yo); } catch (er) {} window.radarDemoResync && window.radarDemoResync(); };
  });
})();
