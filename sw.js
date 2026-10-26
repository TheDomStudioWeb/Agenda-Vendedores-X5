/* X5 Cuyo · Hub Comercial — Service Worker
   - Páginas: primero red (siempre la última versión), si no hay señal usa la copia guardada.
   - Estilos, scripts, íconos y librerías de CDN: copia guardada al instante + actualización en segundo plano.
   - La base de datos (Apps Script) nunca se guarda acá: la maneja el CRM con su propia cola offline.
   Al publicar cambios grandes, subí el número de VERSION. */
const VERSION = 'x5-os-v23';
const PRECACHE = [
  './', './index.html', './radar/index.html', './crm.html', './contratos.html', './simulador.html', './x5check.html', './dni.html', './unificador.html',
  './x5-theme.css', './x5-core.js', './x5-scanner.js', './manifest.json', './icon-192.png', './icon-512.png', './brand/x5-logo-blanco.png', './brand/x5-logo-rojo.png',
  './libs/pdf-lib.min.js', './libs/html2canvas.min.js', './libs/docx.min.js'
];
const CDN = ['cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return; // datos en vivo
  if (url.pathname.includes('/radar/data/')) return; // stock del Radar de Usados: siempre el último

  // Páginas HTML → red primero
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req).then(res => { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Recursos propios y CDN → caché + actualización en segundo plano
  if (url.origin === location.origin || CDN.includes(url.hostname)) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const guardado = await cache.match(req);
        const red = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => guardado);
        return guardado || red;
      })
    );
  }
});
