// /api/backup  (solo administrador)
//   GET              -> descarga un JSON con todos los datos (layouts, builds, equipos, dupes)
//   GET ?list=1      -> lista los respaldos automáticos disponibles
//   POST {data}      -> restaura desde un archivo de respaldo
//   POST {restore, day?} -> vuelve a la versión anterior de una clave (o a la copia de un día)
export const config = { runtime: 'edge' };

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
});

const DATA_RE = /^(layout|build|teams|dupes):[\w\-:.]{1,120}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY = 4_000_000;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}

async function authorized(request) {
  const header = request.headers.get('Authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || !given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(adminKey)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function scanKeys(match) {
  let cursor = '0';
  const keys = [];
  do {
    const [next, batch] = await redis.scan(cursor, { match, count: 500 });
    keys.push(...batch);
    cursor = String(next);
  } while (cursor !== '0' && keys.length < 5000);
  return keys.sort();
}

export default async function handler(request) {
  if (!(await authorized(request))) return json({ error: 'no autorizado' }, 401);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    if (url.searchParams.get('list')) {
      const [prev, daily] = await Promise.all([scanKeys('bak:*'), scanKeys('bakd:*')]);
      return json({ previous: prev.map((k) => k.slice(4)), daily: daily.map((k) => k.slice(5)) });
    }
    const keys = (await Promise.all(['layout:*', 'build:*', 'teams:*', 'dupes:*'].map(scanKeys))).flat();
    const data = {};
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      const vals = await redis.mget(...chunk);
      chunk.forEach((k, j) => { if (vals[j] != null) data[k] = vals[j]; });
    }
    const day = new Date().toISOString().slice(0, 10);
    return json({ app: 'arkanabuilds', version: 1, date: new Date().toISOString(), data }, 200, {
      'Content-Disposition': 'attachment; filename="arkanabuilds-respaldo-' + day + '.json"',
    });
  }

  if (request.method === 'POST') {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'demasiado grande' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'JSON inválido' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'formato inválido' }, 400);

    if (typeof body.restore === 'string') {
      if (!DATA_RE.test(body.restore)) return json({ error: 'clave inválida' }, 400);
      let src = 'bak:' + body.restore;
      if (body.day) {
        if (!DAY_RE.test(body.day)) return json({ error: 'fecha inválida' }, 400);
        src = 'bakd:' + body.day + ':' + body.restore;
      }
      const value = await redis.get(src);
      if (!value) return json({ error: 'no hay respaldo con esos datos' }, 404);
      // antes de volver atrás, se conserva lo actual por si te arrepientes
      const cur = await redis.get(body.restore);
      if (cur) await redis.set('bak:' + body.restore, cur);
      await redis.set(body.restore, value);
      return json({ ok: true, restored: body.restore });
    }

    if (body.data && typeof body.data === 'object') {
      const entries = Object.entries(body.data).filter(([k]) => DATA_RE.test(k));
      if (!entries.length) return json({ error: 'el archivo no tiene datos válidos' }, 400);
      if (entries.length > 2000) return json({ error: 'demasiadas claves' }, 413);
      for (const [k, v] of entries) {
        const cur = await redis.get(k);
        if (cur) await redis.set('bak:' + k, cur);
        await redis.set(k, v);
      }
      return json({ ok: true, restored: entries.length });
    }
  }

  return json({ error: 'método no permitido' }, 405);
}
