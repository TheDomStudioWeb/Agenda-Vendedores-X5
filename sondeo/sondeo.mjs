import fs from 'node:fs';
const U = 'https://script.google.com/macros/s/AKfycbw6ohUpR016N1P1rHk0W3E6PR0FlIoWZdrm2S7Fjf6MWqkwfT5xNb72MT_MobD9yrLLpg/exec';
const out = [];
for (const q of ['marca=Volkswagen&modelo=Gol%20Trend&provincia=Mendoza&desde=2014&hasta=2016', 'marca=Toyota&modelo=Hilux&provincia=C%C3%B3rdoba&desde=2018&hasta=2022']) {
  const t0 = Date.now();
  try { const r = await fetch(`${U}?${q}`, { redirect: 'follow' }); const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
    out.push({ q, status: r.status, ms: Date.now() - t0, ok: j?.ok, fuentes: j?.fuentes, total: j?.autos?.length, muestra: j?.autos?.slice(0, 2), crudo: j ? undefined : txt.slice(0, 800) });
  } catch (e) { out.push({ q, error: e.message }); }
}
fs.writeFileSync('sondeo/apps-script-prueba.json', JSON.stringify(out, null, 1));
