// Radar de usados X5 — arma el stock del día de todas las agencias.
// Reglas de seguridad: si una agencia falla o trae muy pocos autos, se conserva su stock anterior.
import { readFile, writeFile } from 'node:fs/promises';
import * as maipu from './agencias/maipu.mjs';
import { cruzar, marcaPorModelo } from './guia.mjs';

const AGENCIAS = [maipu];                 // sumar acá las próximas (Autocity, etc.)
const MINIMO_RELATIVO = 0.5;              // si trae menos de la mitad que ayer, se considera rota
const STOCK = 'radar/data/stock.json', NOVEDADES = 'radar/data/novedades.json', GUIA = 'radar/data/guia-cca.json';

const leerJSON = async (f, def) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return def; } };
const ahora = new Date().toISOString();
const anterior = await leerJSON(STOCK, { autos: [], agencias: [] });
const novedades = await leerJSON(NOVEDADES, { eventos: [] });
const guia = await leerJSON(GUIA, null);
const previoPorId = new Map(anterior.autos.map(a => [a.id, a]));

const autos = [], estados = [], eventos = [], revisar = [];
let fallas = 0;
for (const ag of AGENCIAS) {
  const previos = anterior.autos.filter(a => a.agencia === ag.agencia.id);
  let lista, error = null;
  try {
    lista = await ag.leer();
    const incompletos = lista.filter(a => !a.modelo || !a.anio || !a.fotos.length).length;
    if (!lista.length) error = 'no se encontró ningún auto';
    else if (previos.length >= 10 && lista.length < previos.length * MINIMO_RELATIVO) error = `trajo ${lista.length} autos y ayer había ${previos.length}`;
    else if (incompletos > lista.length * 0.3) error = `${incompletos} de ${lista.length} autos sin modelo, año o fotos (¿cambió el sitio?)`;
  } catch (e) { error = e.message; }

  if (error) {
    fallas++;
    autos.push(...previos);
    estados.push({ ...ag.agencia, estado: 'error', detalle: error, autos: previos.length, revisado: ahora, actualizado: anterior.agencias.find(x => x.id === ag.agencia.id)?.actualizado || null });
    console.error(`✗ ${ag.agencia.nombre}: ${error}. Se conserva el stock anterior (${previos.length}).`);
    continue;
  }
  // Publicaciones a medio cargar (sin año o sin fotos): no se muestran hasta que la agencia las complete
  for (const a of lista.filter(a => !a.anio || !a.fotos.length))
    revisar.push({ id: a.id, auto: `${a.marca} ${a.modelo}`, url: a.url, texto: 'publicación incompleta (sin año o sin fotos)' });
  lista = lista.filter(a => a.anio && a.fotos.length);
  const ids = new Set();
  for (const a of lista) {
    ids.add(a.id);
    const prev = previoPorId.get(a.id);
    a.agencia = ag.agencia.id;
    if (!a.marca && guia) a.marca = marcaPorModelo(a, guia);
    if (a._texto && (!a.marca || !a.version)) revisar.push({ id: a.id, auto: `${a.marca} ${a.modelo} ${a.anio}`, url: a.url, texto: a._texto });
    delete a._texto;
    a.alta = prev?.alta || (anterior.autos.length ? ahora : a.publicado);
    if (guia) a.guia = cruzar(a, guia);
    if (!prev && anterior.autos.length) eventos.push({ fecha: ahora, tipo: 'nuevo', id: a.id, auto: `${a.marca} ${a.modelo} ${a.anio}`, precio: a.precio, moneda: a.moneda });
    if (prev && prev.precio !== a.precio) eventos.push({ fecha: ahora, tipo: 'precio', id: a.id, auto: `${a.marca} ${a.modelo} ${a.anio}`, antes: prev.precio, precio: a.precio, moneda: a.moneda });
    autos.push(a);
  }
  for (const p of previos) if (!ids.has(p.id)) {
    const dias = Math.round((Date.parse(ahora) - Date.parse(p.alta)) / 864e5);
    eventos.push({ fecha: ahora, tipo: 'baja', id: p.id, auto: `${p.marca} ${p.modelo} ${p.anio}`, precio: p.precio, moneda: p.moneda, dias });
  }
  estados.push({ ...ag.agencia, estado: 'ok', autos: lista.length, revisado: ahora, actualizado: ahora });
  console.log(`✓ ${ag.agencia.nombre}: ${lista.length} autos`);
}

const limite = Date.now() - 90 * 864e5;
novedades.eventos = [...eventos, ...novedades.eventos].filter(e => Date.parse(e.fecha) > limite);
await writeFile(STOCK, JSON.stringify({ actualizado: ahora, guia: guia && { fuente: guia.fuente, mes: guia.mes }, agencias: estados, autos }, null, 1));
await writeFile('radar/data/revisar.json', JSON.stringify({ actualizado: ahora, autos: revisar }, null, 1));
await writeFile(NOVEDADES, JSON.stringify(novedades, null, 1));
console.log(`Eventos nuevos: ${eventos.length}`);
if (fallas) process.exit(1);
