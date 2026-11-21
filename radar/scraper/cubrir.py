#!/usr/bin/env python3
"""Radar de usados · detección automática de patentes y carteles amarillos.

Corre después de actualizar.mjs (GitHub Action). Para cada foto del stock busca:
  - patentes  → caja tipo 'pat'    (el Radar la cubre con una placa con el logo de X5 Argentina)
  - carteles amarillos → caja 'cartel' (el Radar la cubre con un cartel rojo X5)
Las cajas van en proporción de la foto [x, y, ancho, alto, tipo] y se guardan en stock.json → "cubrir".
Cada foto se analiza una sola vez: el resultado queda en radar/data/cubrir.json (caché por URL).
Si un jefe corrige una foto a mano en el Radar, lo manual reemplaza a lo automático.

Variables opcionales:
  CUBRIR_MAX=3000         fotos nuevas por corrida (el resto sigue en la próxima)
  CUBRIR_MUESTRAS=dir     guarda hasta 40 fotos con las cajas dibujadas (para calibrar)
"""
import concurrent.futures as cf, json, os, pathlib, sys, time
import cv2, numpy as np, requests

STOCK = pathlib.Path('radar/data/stock.json')
CACHE = pathlib.Path('radar/data/cubrir.json')
VERSION = 1                       # subirla si cambian los criterios: se vuelven a analizar todas las fotos
MAX_NUEVAS = int(os.environ.get('CUBRIR_MAX', '3000'))
MUESTRAS = os.environ.get('CUBRIR_MUESTRAS')
CONF_PATENTE = 0.30
MARGEN_PATENTE = 0.10             # agranda la caja de la patente un 10% por lado (que no asome nada)
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'


def detector():
    from open_image_models import LicensePlateDetector
    return LicensePlateDetector(detection_model='yolo-v9-t-384-license-plate-end2end', conf_thresh=CONF_PATENTE)


def bajar(url, ses):
    origen = '/'.join(url.split('/')[:3]) + '/'
    for h in ({'User-Agent': UA}, {'User-Agent': UA, 'Referer': origen, 'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'}):
        try:
            r = ses.get(url, headers=h, timeout=25)
            if r.ok and r.content:
                im = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
                if im is not None:
                    return im
        except requests.RequestException:
            pass
    return None


def patentes(det, im):
    H, W = im.shape[:2]
    out = []
    for r in det.predict(im):
        b = r.bounding_box
        w, h = b.x2 - b.x1, b.y2 - b.y1
        if w <= 0 or h <= 0 or w > W * 0.6:
            continue
        mx, my = w * MARGEN_PATENTE, h * MARGEN_PATENTE * 2.5
        x1, y1 = max(0, b.x1 - mx), max(0, b.y1 - my)
        x2, y2 = min(W, b.x2 + mx), min(H, b.y2 + my)
        out.append([x1 / W, y1 / H, (x2 - x1) / W, (y2 - y1) / H, 'pat'])
    return out


def carteles(im, evitar):
    """Carteles amarillos: zonas de amarillo intenso, bastante rectangulares y de tamaño razonable."""
    H, W = im.shape[:2]
    esc = 800 / max(H, W)
    chico = cv2.resize(im, (int(W * esc), int(H * esc))) if esc < 1 else im
    h, w = chico.shape[:2]
    hsv = cv2.cvtColor(chico, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, (18, 120, 150), (34, 255, 255))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in cnts:
        x, y, cw, ch = cv2.boundingRect(c)
        area, caja = cv2.contourArea(c), cw * ch
        if caja < w * h * 0.002 or caja > w * h * 0.12:       # ni un puntito ni medio auto amarillo
            continue
        if area / caja < 0.55 or not (0.35 < cw / ch < 4):       # tiene que parecer un cartel
            continue
        # adentro debe haber texto oscuro (el teléfono / "VENDO"): descarta paragolpes o luces amarillas
        oscuro = (hsv[y:y + ch, x:x + cw, 2] < 90).mean()
        if oscuro < 0.02:
            continue
        p = 0.08
        bx = [max(0, x / w - p * cw / w), max(0, y / h - p * ch / h), min(1, (cw / w) * (1 + 2 * p)), min(1, (ch / h) * (1 + 2 * p)), 'cartel']
        if any(solapa(bx, e) > 0.3 for e in evitar):
            continue
        out.append(bx)
    return out


def solapa(a, b):
    ix = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    return ix * iy / max(1e-9, min(a[2] * a[3], b[2] * b[3]))


def redondear(cajas):
    return [[round(v, 3) for v in c[:4]] + [c[4]] for c in cajas]


def dibujar(im, cajas, destino):
    H, W = im.shape[:2]
    for x, y, w, h, t in cajas:
        col = (45, 24, 227) if t == 'cartel' else (255, 160, 0)
        cv2.rectangle(im, (int(x * W), int(y * H)), (int((x + w) * W), int((y + h) * H)), col, 4)
        cv2.putText(im, t, (int(x * W), max(20, int(y * H) - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.9, col, 2)
    cv2.imwrite(str(destino), im, [cv2.IMWRITE_JPEG_QUALITY, 70])


def main():
    stock = json.loads(STOCK.read_text(encoding='utf8'))
    try:
        cache = json.loads(CACHE.read_text(encoding='utf8'))
    except (FileNotFoundError, json.JSONDecodeError):
        cache = {}
    if cache.get('_v') != VERSION:
        cache = {'_v': VERSION}
    urls = list(dict.fromkeys(f for a in stock['autos'] if not a.get('propio') for f in a.get('fotos', [])))
    nuevas = [u for u in urls if u not in cache or (cache[u].get('error') and cache[u].get('intentos', 0) < 3)][:MAX_NUEVAS]
    print(f'Fotos en stock: {len(urls)} · ya analizadas: {len(urls) - len(nuevas)} · a analizar: {len(nuevas)}')

    det = detector() if nuevas else None
    ses = requests.Session()
    t0, n_pat, n_car, n_err, muestras = time.time(), 0, 0, 0, 0
    if MUESTRAS:
        pathlib.Path(MUESTRAS).mkdir(parents=True, exist_ok=True)
    with cf.ThreadPoolExecutor(8) as ex:
        for u, im in zip(nuevas, ex.map(lambda u: bajar(u, ses), nuevas)):
            if im is None:
                prev = cache.get(u, {})
                cache[u] = {'c': [], 'error': 1, 'intentos': prev.get('intentos', 0) + 1}
                n_err += 1
                continue
            p = patentes(det, im)
            c = carteles(im, p)
            cajas = redondear(p + c)
            cache[u] = {'c': cajas}
            n_pat += len(p); n_car += len(c)
            if MUESTRAS and cajas and muestras < 40:
                dibujar(im, cajas, pathlib.Path(MUESTRAS) / f'{muestras:02d}.jpg'); muestras += 1

    vigentes = set(urls)
    cache = {k: v for k, v in cache.items() if k == '_v' or k in vigentes}     # se olvidan las fotos que ya no están
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    stock['cubrir'] = {u: v['c'] for u, v in cache.items() if u != '_v' and v.get('c')}
    STOCK.write_text(json.dumps(stock, ensure_ascii=False, indent=1), encoding='utf8')
    con = sum(1 for u in urls if cache.get(u, {}).get('c'))
    print(f'Listo en {time.time() - t0:.0f}s · patentes nuevas: {n_pat} · carteles nuevos: {n_car} · sin poder bajar: {n_err} · fotos con tapas: {con}/{len(urls)}')


if __name__ == '__main__':
    sys.exit(main())
