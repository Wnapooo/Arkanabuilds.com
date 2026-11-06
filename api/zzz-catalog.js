// /api/zzz-catalog  (motores-W y discos desde nanoka, sin KV)
export const config = { runtime: 'edge' };

const NANOKA = 'https://static.nanoka.cc';
const bareName = (p) => String(p || '').split('/').pop().replace(/\.[a-z0-9]+$/i, '');
const nameOf = (x) => {
  const v = x && (x.en || x.zh || x.name);
  return typeof v === 'string' ? v : (v && v.name) || '';
};

function json(data, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
  });
}

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'método no permitido' }, 405);
  try {
    const man = await (await fetch(NANOKA + '/manifest.json')).json();
    const ver = man && man.zzz && man.zzz.live;
    if (!ver) return json({ error: 'sin versión' }, 502);
    const [w, e] = await Promise.all(['weapon', 'equipment'].map((f) =>
      fetch(NANOKA + '/zzz/' + ver + '/' + f + '.json').then((r) => (r.ok ? r.json() : Promise.reject()))));
    const lst = (o) => Object.entries(o || {})
      .map(([i, x]) => ({ i: String(i), n: nameOf(x).slice(0, 80), c: bareName(x && x.icon).slice(0, 100) }))
      .filter((x) => x.n);
    // cacheado 10 min en el edge de Vercel, igual que el 'cf.cacheTtl' original
    return json({ cones: lst(w), sets: lst(e) }, 200, 'public, max-age=600');
  } catch {
    return json({ error: 'catálogo no disponible' }, 502);
  }
}
