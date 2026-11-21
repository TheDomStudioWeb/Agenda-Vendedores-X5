#!/usr/bin/env python3
"""Arma radar-demo.html: el Radar en modo demo en un único archivo para descargar y abrir sin conexión.
Uso: python3 radar/armar-demo.py [salida.html]
Incluye el tema, los logos y el stock inventado de demo.js. Quita las pestañas Compra y Guía CCA
(dependen de servicios en línea) y agrega la firma de The DOM Studio Web."""
import base64, pathlib, re, sys

R = pathlib.Path(__file__).resolve().parent
RAIZ = R.parent
salida = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else RAIZ / 'radar-demo.html')

def data_uri(p):
    return 'data:image/png;base64,' + base64.b64encode((RAIZ / p).read_bytes()).decode()

css = (RAIZ / 'x5-theme.css').read_text(encoding='utf8')
for logo in ('brand/x5-logo-blanco.png', 'brand/x5-logo-rojo.png'):
    css = css.replace(f'url("{logo}")', f'url("{data_uri(logo)}")')

h = (R / 'index.html').read_text(encoding='utf8')
h = h.replace('<link rel="stylesheet" href="../x5-theme.css">', '<style>\n' + css + '\n</style>')
h = re.sub(r'<link rel="(manifest|icon)"[^>]*>\n', '', h)
h = h.replace('src="../brand/x5-logo-blanco.png"', f'src="{data_uri("brand/x5-logo-blanco.png")}"')
h = re.sub(r'<a class="x5-back"[^>]*>.*?</a>', '', h, flags=re.S)
h = h.replace('<button data-v="compra">Compra</button>', '').replace('<button data-v="guia">Guía CCA</button>', '')
loader = re.search(r'<script>if \(/\[\?&\]demo=1/.*?</script>\n', h).group(0)
h = h.replace(loader, '<script>\n' + (R / 'demo.js').read_text(encoding='utf8') + '\n</script>\n')
# Si alguien guardó «compra» o «guia» como última vista, arranca en Cliente
h = h.replace("<script>\n(function () {\n  'use strict';", "<script>\ntry { if (/compra|guia/.test(localStorage.getItem('radar.vista') || '')) localStorage.removeItem('radar.vista'); } catch (e) {}\n(function () {\n  'use strict';", 1)
firma = ('<footer style="text-align:center;font:500 .72rem Montserrat,sans-serif;color:var(--muted);padding:22px 12px 30px">'
         'Demo del Radar de Usados · X5 Argentina · Desarrollado por <b>The DOM Studio Web</b> · '
         '<a href="https://thedomstudioweb.github.io/" target="_blank" rel="noopener" style="color:inherit">thedomstudioweb.github.io</a> · '
         '<a href="https://wa.me/5492613431216" target="_blank" rel="noopener" style="color:inherit">WhatsApp 261-3431216</a></footer>\n')
h = h.replace('<dialog id="ficha">', firma + '<dialog id="ficha">', 1)
salida.write_text(h, encoding='utf8')
print(f'{salida} · {len(h) // 1024} KB')
