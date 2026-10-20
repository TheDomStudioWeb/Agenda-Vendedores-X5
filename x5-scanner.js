/* =====================================================================
   X5 Scanner — modo escáner liviano (sin librerías)
   - Detecta el documento automáticamente (hoja clara sobre fondo)
   - 4 esquinas arrastrables + corrección de perspectiva (endereza la hoja)
   - Filtros: Original · Color mejorado · Documento (B/N nítido)
   - Girar 90°
   Uso:  const canvas = await X5Scanner.abrir(file, { titulo: 'Frente del DNI', filtro: 'color' });
         (devuelve null si el usuario cancela)
   ===================================================================== */
(function () {
  'use strict';

  const css = `
  .xs-bg{position:fixed;inset:0;z-index:2000;background:#000;display:flex;flex-direction:column;color:#fff;font-family:var(--font,system-ui)}
  .xs-top{display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;gap:10px}
  .xs-top b{font-size:.95rem}.xs-top span{font-size:.72rem;color:#9aa3ad}
  .xs-stage{flex:1;position:relative;overflow:hidden;touch-action:none;display:flex;align-items:center;justify-content:center}
  .xs-stage canvas{max-width:100%;max-height:100%;display:block}
  .xs-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .xs-h{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;touch-action:none;cursor:grab;display:grid;place-items:center}
  .xs-h::after{content:'';width:18px;height:18px;border-radius:50%;background:rgba(227,24,45,.25);border:3px solid #E3182D;box-shadow:0 0 0 3px rgba(0,0,0,.35)}
  .xs-loupe{position:absolute;width:110px;height:110px;border-radius:50%;border:3px solid #E3182D;overflow:hidden;pointer-events:none;display:none;box-shadow:0 6px 20px rgba(0,0,0,.6);background:#000}
  .xs-loupe canvas{width:100%;height:100%}
  .xs-bar{padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:10px;background:#0b0c0f}
  .xs-f{display:flex;gap:6px}.xs-f button{flex:1;padding:9px 6px;border-radius:10px;border:1px solid #2a2f37;background:#15181d;color:#cfd5dc;font-weight:600;font-size:.78rem}
  .xs-f button.on{border-color:#E3182D;color:#E3182D;background:rgba(227,24,45,.1)}
  .xs-a{display:flex;gap:8px}.xs-a button{flex:1;padding:13px;border-radius:12px;border:0;font-weight:700;font-size:.92rem}
  .xs-cancel{background:#1c2026;color:#fff}.xs-rot{background:#1c2026;color:#fff;flex:0 0 56px!important}.xs-ok{background:#E3182D;color:#fff}
  .xs-prev{max-width:100%;max-height:100%;object-fit:contain}
  .xs-busy{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font-weight:600}
  `;
  let estiloListo = false;
  function inyectarEstilo() { if (estiloListo) return; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); estiloListo = true; }

  const cargar = (file) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { res(img); URL.revokeObjectURL(url); }; img.onerror = rej; img.src = url;
  });

  /* ── Detección automática del documento ──────────────────────── */
  function detectar(src) {
    const S = 260, k = S / Math.max(src.width, src.height);
    const w = Math.max(2, Math.round(src.width * k)), h = Math.max(2, Math.round(src.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h), hist = new Array(256).fill(0);
    for (let i = 0; i < w * h; i++) { const v = (d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114) | 0; gray[i] = v; hist[v]++; }
    // Otsu
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0, wB = 0, best = 0, th = 128;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = w * h - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } }
    // Componente clara más grande (BFS)
    const lab = new Int32Array(w * h).fill(-1); let mejor = null, mejorN = 0;
    for (let s = 0; s < w * h; s++) {
      if (lab[s] !== -1 || gray[s] <= th) continue;
      const cola = [s]; lab[s] = s; let n = 0; const pts = [];
      while (cola.length) {
        const p = cola.pop(); n++; const x = p % w, y = (p / w) | 0; pts.push(x, y);
        const vec = [p - 1, p + 1, p - w, p + w];
        if (x === 0) vec[0] = -1; if (x === w - 1) vec[1] = -1;
        for (const q of vec) if (q >= 0 && q < w * h && lab[q] === -1 && gray[q] > th) { lab[q] = s; cola.push(q); }
      }
      if (n > mejorN) { mejorN = n; mejor = pts; }
    }
    const area = mejorN / (w * h);
    if (!mejor || area < 0.12 || area > 0.97) return null;
    // Esquinas por extremos de x+y y x−y
    let tl, tr, br, bl, a = Infinity, b = -Infinity, cc = -Infinity, dd = Infinity;
    for (let i = 0; i < mejor.length; i += 2) {
      const x = mejor[i], y = mejor[i + 1], s1 = x + y, s2 = x - y;
      if (s1 < a) { a = s1; tl = [x, y]; } if (s1 > b) { b = s1; br = [x, y]; }
      if (s2 > cc) { cc = s2; tr = [x, y]; } if (s2 < dd) { dd = s2; bl = [x, y]; }
    }
    return [tl, tr, br, bl].map(([x, y]) => [x / k, y / k]);
  }

  /* ── Homografía y corrección de perspectiva ─────────────────── */
  function homografia(src, dst) {
    // Resuelve H tal que dst = H·src (8 incógnitas)
    const A = [], B = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
    }
    for (let c = 0; c < 8; c++) { // Gauss
      let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
      for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
    }
    return B.map((v, i) => v / A[i][i]).concat(1);
  }

  /* Proporción real de la hoja (ancho/alto) a partir de la perspectiva de sus 4 esquinas.
     Método de Zhang & He: estima la distancia focal de la cámara y recupera el rectángulo original.
     Sin esto, una hoja fotografiada en ángulo sale estirada. */
  function proporcion(q, ancho, alto) {
    const u0 = ancho / 2, v0 = alto / 2;
    const m = [q[0], q[1], q[3], q[2]].map(([x, y]) => [x - u0, y - v0, 1]); // TL, TR, BL, BR
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const [m1, m2, m3, m4] = m;
    const c14 = cross(m1, m4);
    const k2 = dot(c14, m3) / dot(cross(m2, m4), m3), k3 = dot(c14, m2) / dot(cross(m3, m4), m2);
    const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]], n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
    const diag = Math.hypot(ancho, alto);
    let f2 = null;
    if (Math.abs(n2[2]) > 1e-4 && Math.abs(n3[2]) > 1e-4) {
      f2 = -((n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]));
    }
    // Cámara de teléfono típica: distancia focal ≈ 0,8 de la diagonal. Se usa si la estimación no es creíble.
    let f = f2 && f2 > 0 ? Math.sqrt(f2) : 0.8 * diag;
    if (f < 0.35 * diag || f > 2.2 * diag) f = 0.8 * diag;
    const nn = (n) => { const a = n[0] / f, b = n[1] / f; return Math.hypot(a, b, n[2]); };
    const r = nn(n2) / nn(n3);
    return isFinite(r) && r > 0.2 && r < 5 ? r : null;
  }
  const FORMATOS = [1 / 1.4142, 1.4142, 1.586, 1 / 1.586]; // A4 vertical/horizontal, tarjeta (DNI) horizontal/vertical
  function ajustarFormato(r) { for (const f of FORMATOS) if (Math.abs(r / f - 1) < 0.09) return f; return r; }

  function enderezar(img, q, opts = {}) {
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    // Se achica apenas el recorte (0,8 %) para no arrastrar el borde oscuro de la hoja
    const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
    q = q.map(([x, y]) => [x + (cx - x) * 0.008, y + (cy - y) * 0.008]);
    let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
    if (opts.proporcion !== false) {
      const r = proporcion(q, img.width, img.height);
      if (r) { const rr = ajustarFormato(r), area = W * H; H = Math.sqrt(area / rr); W = rr * H; }
    }
    const lim = 2200 / Math.max(W, H); if (lim < 1) { W *= lim; H *= lim; }
    W = Math.round(W); H = Math.round(H);
    // H inversa: de la salida a la foto original
    const M = homografia([[0, 0], [W, 0], [W, H], [0, H]], q);
    const sc = document.createElement('canvas'); sc.width = img.width; sc.height = img.height;
    const sg = sc.getContext('2d', { willReadFrequently: true }); sg.drawImage(img, 0, 0);
    const sd = sg.getImageData(0, 0, sc.width, sc.height).data, sw = sc.width, sh = sc.height;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const og = out.getContext('2d'); const od = og.createImageData(W, H), o = od.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const z = M[6] * x + M[7] * y + 1;
        const fx = (M[0] * x + M[1] * y + M[2]) / z, fy = (M[3] * x + M[4] * y + M[5]) / z;
        const x0 = fx | 0, y0 = fy | 0, j = (y * W + x) * 4;
        if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { o[j] = o[j + 1] = o[j + 2] = 255; o[j + 3] = 255; continue; }
        const ax = fx - x0, ay = fy - y0, i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
        for (let c = 0; c < 3; c++) {
          const t = sd[i00 + c] + (sd[i10 + c] - sd[i00 + c]) * ax, bt = sd[i01 + c] + (sd[i11 + c] - sd[i01 + c]) * ax;
          o[j + c] = t + (bt - t) * ay;
        }
        o[j + 3] = 255;
      }
    }
    og.putImageData(od, 0, 0);
    return out;
  }

  /* ── Filtros ─────────────────────────────────────────────────── */
  function filtrar(canvas, modo) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0);
    if (modo === 'original') return c;
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data, n = d.length / 4;
    // Punto blanco/negro por percentiles
    const h = new Array(256).fill(0);
    for (let i = 0; i < n; i++) h[(d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114) | 0]++;
    let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) { acc += h[i]; if (acc > n * 0.02) { lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--) { acc += h[i]; if (acc > n * (modo === 'doc' ? 0.35 : 0.04)) { hi = i; break; } }
    const rango = Math.max(30, hi - lo);
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      if (modo === 'doc') {
        let v = ((d[j] * .299 + d[j + 1] * .587 + d[j + 2] * .114) - lo) / rango;
        v = Math.min(1, Math.max(0, v)); v = v < .5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v); // curva S
        d[j] = d[j + 1] = d[j + 2] = v * 255;
      } else {
        for (let k = 0; k < 3; k++) d[j + k] = Math.min(255, Math.max(0, (d[j + k] - lo) * 255 / rango * 1.02));
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  function rotar(canvas) {
    const c = document.createElement('canvas'); c.width = canvas.height; c.height = canvas.width;
    const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(Math.PI / 2); g.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return c;
  }

  /* ── Interfaz ────────────────────────────────────────────────── */
  async function abrir(file, opts = {}) {
    inyectarEstilo();
    const img0 = await cargar(file);
    // Trabajamos con la foto reducida a 2400 px para que sea ágil en cualquier teléfono
    const k0 = Math.min(1, 2400 / Math.max(img0.naturalWidth, img0.naturalHeight));
    const base = document.createElement('canvas'); base.width = Math.round(img0.naturalWidth * k0); base.height = Math.round(img0.naturalHeight * k0);
    base.getContext('2d').drawImage(img0, 0, 0, base.width, base.height);

    return new Promise((resolve) => {
      const bg = document.createElement('div'); bg.className = 'xs-bg';
      bg.innerHTML = `
        <div class="xs-top"><div><b>${opts.titulo || 'Ajustá el documento'}</b><br><span class="xs-sub">Arrastrá las esquinas hasta los bordes de la hoja</span></div></div>
        <div class="xs-stage"><canvas class="xs-cv"></canvas><svg class="xs-svg"><polygon fill="rgba(227,24,45,.12)" stroke="#E3182D" stroke-width="2"/></svg><div class="xs-loupe"><canvas width="220" height="220"></canvas></div><div class="xs-busy">Procesando…</div></div>
        <div class="xs-bar">
          <div class="xs-f hidden-f">
            <button data-f="original">Original</button><button data-f="color">Color mejorado</button><button data-f="doc">Documento</button>
          </div>
          <div class="xs-a"><button class="xs-cancel">Cancelar</button><button class="xs-rot" title="Girar">⟳</button><button class="xs-ok">Recortar</button></div>
        </div>`;
      document.body.appendChild(bg);
      const stage = bg.querySelector('.xs-stage'), cv = bg.querySelector('.xs-cv'), svg = bg.querySelector('.xs-svg'), poly = svg.querySelector('polygon');
      const loupe = bg.querySelector('.xs-loupe'), lcv = loupe.querySelector('canvas'), lg = lcv.getContext('2d');
      const busy = bg.querySelector('.xs-busy'), fbar = bg.querySelector('.xs-f'), sub = bg.querySelector('.xs-sub');
      const btnOk = bg.querySelector('.xs-ok'), btnRot = bg.querySelector('.xs-rot'); const btnCancel = bg.querySelector('.xs-cancel');
      fbar.style.display = 'none';

      let fuente = base, quad = null, handles = [], fase = 'ajuste', recorte = null, filtro = opts.filtro || 'color';
      const ctx = cv.getContext('2d');

      function pintarFuente() {
        cv.width = fuente.width; cv.height = fuente.height; ctx.drawImage(fuente, 0, 0);
      }
      function escala() { const r = cv.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { k: r.width / cv.width, ox: r.left - s.left, oy: r.top - s.top }; }
      function ubicar() {
        const { k, ox, oy } = escala();
        handles.forEach((h, i) => { h.style.left = (ox + quad[i][0] * k) + 'px'; h.style.top = (oy + quad[i][1] * k) + 'px'; });
        poly.setAttribute('points', quad.map(([x, y]) => `${ox + x * k},${oy + y * k}`).join(' '));
      }
      function iniciarAjuste() {
        fase = 'ajuste'; recorte = null; fbar.style.display = 'none'; btnOk.textContent = 'Recortar'; btnCancel.textContent = 'Cancelar'; sub.textContent = 'Arrastrá las esquinas hasta los bordes de la hoja';
        svg.style.display = ''; pintarFuente();
        const w = fuente.width, h = fuente.height, m = 0.06;
        quad = detectar(fuente) || [[w * m, h * m], [w * (1 - m), h * m], [w * (1 - m), h * (1 - m)], [w * m, h * (1 - m)]];
        handles.forEach(h => h.remove());
        handles = quad.map((_, i) => { const h = document.createElement('div'); h.className = 'xs-h'; h.dataset.i = i; stage.appendChild(h); return h; });
        requestAnimationFrame(ubicar);
      }
      function vistaPrevia() {
        const res = filtrar(recorte, filtro);
        cv.width = res.width; cv.height = res.height; ctx.drawImage(res, 0, 0);
        fbar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.f === filtro));
      }

      // Arrastre de esquinas con lupa
      let drag = -1;
      stage.addEventListener('pointerdown', (e) => {
        if (fase !== 'ajuste') return;
        const h = e.target.closest('.xs-h'); if (!h) return;
        drag = +h.dataset.i; h.setPointerCapture(e.pointerId); e.preventDefault();
      });
      stage.addEventListener('pointermove', (e) => {
        if (drag < 0) return;
        const { k, ox, oy } = escala(), s = stage.getBoundingClientRect();
        const x = Math.min(cv.width, Math.max(0, (e.clientX - s.left - ox) / k)), y = Math.min(cv.height, Math.max(0, (e.clientY - s.top - oy) / k));
        quad[drag] = [x, y]; ubicar();
        // lupa
        loupe.style.display = 'block';
        const lx = e.clientX - s.left, ly = e.clientY - s.top;
        loupe.style.left = Math.min(s.width - 120, Math.max(10, lx - 55)) + 'px';
        loupe.style.top = (ly > 160 ? ly - 150 : ly + 40) + 'px';
        const r = 40 / k; lg.fillStyle = '#000'; lg.fillRect(0, 0, 220, 220);
        lg.drawImage(fuente, x - r, y - r, r * 2, r * 2, 0, 0, 220, 220);
        lg.strokeStyle = '#E3182D'; lg.lineWidth = 2; lg.beginPath(); lg.moveTo(110, 90); lg.lineTo(110, 130); lg.moveTo(90, 110); lg.lineTo(130, 110); lg.stroke();
      });
      const soltar = () => { drag = -1; loupe.style.display = 'none'; };
      stage.addEventListener('pointerup', soltar); stage.addEventListener('pointercancel', soltar);
      const onResize = () => { if (fase === 'ajuste') ubicar(); };
      window.addEventListener('resize', onResize);

      fbar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; filtro = b.dataset.f; vistaPrevia(); });

      btnRot.onclick = () => {
        if (fase === 'ajuste') { fuente = rotar(fuente); iniciarAjuste(); }
        else { recorte = rotar(recorte); vistaPrevia(); }
      };
      btnOk.onclick = () => {
        if (fase === 'ajuste') {
          busy.style.display = 'flex';
          setTimeout(() => {
            recorte = enderezar(fuente, quad);
            fase = 'filtro'; handles.forEach(h => h.remove()); handles = []; svg.style.display = 'none';
            fbar.style.display = 'flex'; btnOk.textContent = 'Usar'; btnCancel.textContent = 'Volver'; sub.textContent = 'Elegí cómo se ve mejor';
            vistaPrevia(); busy.style.display = 'none';
          }, 30);
        } else { cerrar(filtrar(recorte, filtro)); }
      };
      bg.querySelector('.xs-cancel').onclick = () => { if (fase === 'filtro') iniciarAjuste(); else cerrar(null); };

      function cerrar(v) { window.removeEventListener('resize', onResize); bg.remove(); resolve(v); }
      iniciarAjuste();
    });
  }

  window.X5Scanner = { abrir, enderezar, filtrar, detectar, proporcion };
})();
