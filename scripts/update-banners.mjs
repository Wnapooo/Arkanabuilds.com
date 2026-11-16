import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.ennead.cc/mihoyo/';
const OUT = new URL('../banners.json', import.meta.url);
const GAMES = { starrail: 'starrail', zenless: 'zenless' };

let prev = {};
try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch {}

const out = { updated: new Date().toISOString() };
let ok = 0;
for (const [key, slug] of Object.entries(GAMES)) {
  try {
    const r = await fetch(`${API}${slug}/calendar`, { headers: { 'user-agent': 'banners-updater' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j.banners)) throw new Error('sin campo banners');
    out[key] = j.banners;
    ok++;
    console.log(`${slug}: ${j.banners.length} banners`);
  } catch (e) {
    console.warn(`${slug}: falló (${e.message}), se conserva lo anterior`);
    out[key] = Array.isArray(prev[key]) ? prev[key] : null;
  }
  await new Promise(res => setTimeout(res, 1000));
}

if (!ok) { console.error('Ninguna consulta funcionó; no se escribe nada.'); process.exit(0); }
await writeFile(OUT, JSON.stringify(out));
