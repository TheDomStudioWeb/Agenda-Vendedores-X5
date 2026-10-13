/* =====================================================================
   X5 Cuyo · Hub Comercial — Utilidades compartidas
   Cargar en todas las mini apps:  <script src="x5-core.js"></script>
   ===================================================================== */
(function () {
  'use strict';

  const X5 = {};

  /** Escapa texto para insertarlo en HTML (evita que un nombre con < o ' rompa la página). */
  X5.esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** $ 1.234.567 */
  X5.money = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n) || 0);
  /** $12,3M / $850K — para ejes y etiquetas cortas */
  X5.moneyShort = (n) => {
    n = Number(n) || 0;
    const a = Math.abs(n);
    if (a >= 1e6) return '$' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString('es-AR') + 'K';
    return '$' + Math.round(n);
  };

  /** Fecha local YYYY-MM-DD (no UTC: evita que después de las 21 hs "hoy" sea mañana). */
  X5.hoyISO = (d = new Date()) => {
    const z = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };
  X5.fechaCorta = (iso) => {
    if (!iso) return '';
    const s = String(iso).split('T')[0].split('-');
    return s.length === 3 ? `${s[2]}/${s[1]}` : String(iso);
  };
  X5.fechaLarga = (iso) => {
    if (!iso) return '';
    const s = String(iso).split('T')[0].split('-');
    return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(iso);
  };

  /* ── Toast ─────────────────────────────────────────────────────── */
  let host;
  X5.toast = (msg, tipo = '', ms = 2600) => {
    if (!host) { host = document.createElement('div'); host.className = 'x5-toast-host'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'x5-toast ' + tipo;
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms);
  };

  /* ── Guardar / compartir archivos ──────────────────────────────────
     Funciona en: navegador (descarga), iPhone (hoja de compartir) y la
     APK de Android Studio, que debe exponer:
        window.X5Android.saveFile(base64, nombre, mime)   → guarda en Descargas
        window.X5Android.shareFile(base64, nombre, mime)  → abre "Compartir"
     (opcional; si no existe, se usa el método web) */
  const blobToBase64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

  X5.esApp = () => !!(window.X5Android && window.X5Android.saveFile);

  X5.guardarArchivo = async (blob, nombre) => {
    const mime = blob.type || 'application/octet-stream';
    if (X5.esApp()) {
      window.X5Android.saveFile(await blobToBase64(blob), nombre, mime);
      return 'app';
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'descarga';
  };

  X5.puedeCompartir = (blob, nombre) => {
    if (window.X5Android && window.X5Android.shareFile) return true;
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([blob], nombre, { type: blob.type })] })); }
    catch (e) { return false; }
  };

  X5.compartirArchivo = async (blob, nombre, texto = '') => {
    if (window.X5Android && window.X5Android.shareFile) {
      window.X5Android.shareFile(await blobToBase64(blob), nombre, blob.type);
      return true;
    }
    const file = new File([blob], nombre, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nombre, text: texto }); return true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
    await X5.guardarArchivo(blob, nombre);
    return true;
  };

  /* ── Imágenes ──────────────────────────────────────────────────── */
  /** Carga un File/Blob como <img>, respetando la orientación EXIF. */
  X5.cargarImagen = (file) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });

  /** Reduce una foto a un lado máximo y la devuelve como JPEG (Blob). */
  X5.comprimir = async (fileOrImg, maxLado = 1800, calidad = 0.82) => {
    const img = fileOrImg instanceof HTMLImageElement || fileOrImg instanceof HTMLCanvasElement ? fileOrImg : await X5.cargarImagen(fileOrImg);
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    const k = Math.min(1, maxLado / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', calidad));
    return { blob, width: c.width, height: c.height };
  };

  /** Nombre de archivo seguro: "Juan Pérez" → "Juan_Perez" */
  X5.slug = (s) => String(s || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'archivo';

  /* ── Service worker (registro único para todas las páginas) ─────── */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw && nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              X5.toast('Hay una versión nueva. Se aplicará al volver a abrir.', '', 4000);
            }
          });
        });
      }).catch(() => {});
    });
  }

  window.X5 = X5;
})();
