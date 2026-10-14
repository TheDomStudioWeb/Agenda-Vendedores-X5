"""Convierte el PDF de la Guía Oficial de Precios CCA en los datos que usan el Radar y el Simulador.
Uso: python radar/scraper/guia_cca.py radar/guia/cca-AAAA-MM.pdf
Genera radar/data/guia-cca.json (todas las versiones) y radar/data/simulador-base.json (medianas por categoría)."""
import datetime, json, re, statistics, sys
import pdfplumber

pdf_path = sys.argv[1]
m = re.search(r'(\d{4})-(\d{2})', pdf_path)
NUM = re.compile(r'^[\d.,]+$')
filas, marca, modelo, mes = [], None, None, f'{m.group(1)}-{m.group(2)}' if m else ''

with pdfplumber.open(pdf_path) as pdf:
    for p in pdf.pages:
        palabras = p.extract_words(extra_attrs=['fontname'])
        lineas = {}
        for w in palabras: lineas.setdefault(round(w['top']), []).append(w)
        cab, y_cab = {}, None
        for y, l in sorted(lineas.items()):
            t = [w['text'] for w in l]
            if 'Km' in t and any(re.fullmatch(r'20\d\d', x) for x in t):
                y_cab = y
                for w in l:
                    if w['text'] == 'Km': cab['0km'] = w['x1']
                    elif re.fullmatch(r'20\d\d', w['text']): cab[w['text']] = w['x1']
                if not mes:
                    enc = ' '.join(w['text'] for w in sorted(lineas.get(min(lineas), []), key=lambda w: w['x0']))
                    mm = re.search(r'(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(20\d\d)', enc)
                    if mm: mes = mm.group(2) + '-' + str(['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].index(mm.group(1)) + 1).zfill(2)
                break
        if not cab: continue
        for y, l in sorted(lineas.items()):
            if y <= y_cab: continue
            l.sort(key=lambda w: w['x0'])
            texto = [w for w in l if w['x0'] < 300]
            nums = [w for w in l if w['x0'] >= 300 and NUM.match(w['text'])]
            nombre = ' '.join(w['text'] for w in texto)
            if not nombre: continue
            if not nums:
                if 'Italic' in texto[0]['fontname']: modelo = nombre
                elif not re.search(r'\d', nombre): marca, modelo = nombre, None
                continue
            valores = {}
            for w in nums:
                col = min(cab, key=lambda k: abs(cab[k] - w['x1']))
                t = re.sub(r',(\d{1,2})$', r'.\1', w['text']).replace(',', '')
                valores[col] = round(float(t)) * 1000  # la guía está en miles de pesos
            if marca and modelo: filas.append((marca, modelo, nombre, valores))

if len(filas) < 3000:
    sys.exit(f'La guía trae solo {len(filas)} versiones: ¿es el PDF correcto? No se actualiza nada.')

marcas = {}
for ma, mo, ver, val in filas: marcas.setdefault(ma, {}).setdefault(mo, []).append([ver, val])
json.dump({'fuente': 'Guía Oficial de Precios CCA', 'mes': mes, 'unidad': 'pesos', 'marcas': marcas},
          open('radar/data/guia-cca.json', 'w'), ensure_ascii=False, separators=(',', ':'))

# Simulador: mediana de los modelos de referencia de cada categoría (sin margen X5)
CATEGORIAS = {
    'pequeno':    [('VOLKSWAGEN', 'GOL TREND'), ('PEUGEOT', '208'), ('TOYOTA', 'YARIS')],
    'familiar':   [('FIAT', 'CRONOS'), ('TOYOTA', 'COROLLA')],
    'utilitario': [('RENAULT', 'KANGOO'), ('RENAULT', 'KANGOO II EXPRESS'), ('PEUGEOT', 'PARTNER')],
    'suv':        [('FORD', 'ECOSPORT'), ('FORD', 'ECOSPORT KINETIC DESIGN ATTRACTION'), ('CHEVROLET', 'TRACKER'), ('VOLKSWAGEN', 'T-CROSS')],
    'camioneta':  [('TOYOTA', 'HILUX PICK - UP'), ('VOLKSWAGEN', 'AMAROK PICK - UP')],
}
RANGOS = {'2010_2015': [str(a) for a in range(2010, 2016)], '2015_2020': [str(a) for a in range(2015, 2021)],
          '2020_2025': [str(a) for a in range(2020, 2026)], '0km': ['0km']}
base = {}
for cat, modelos in CATEGORIAS.items():
    base[cat] = {}
    for rango, anios in RANGOS.items():
        v = [val[a] for ma, mo in modelos for _, val in marcas.get(ma, {}).get(mo, []) for a in anios if a in val]
        if v: base[cat][rango] = int(round(statistics.median(v), -5))
json.dump({'fuente': 'Guía Oficial de Precios CCA', 'mes': mes, 'versiones': len(filas), 'procesado': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'base': base,
           'modelos': {c: [mo.title() for _, mo in ms] for c, ms in CATEGORIAS.items()}},
          open('radar/data/simulador-base.json', 'w'), ensure_ascii=False, indent=1)
print(f'Guía {mes}: {len(filas)} versiones, {len(marcas)} marcas')
