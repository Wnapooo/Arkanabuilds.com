// /api/builds?g=<juego>&c=<slug>
export const config = { runtime: 'edge' };

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const PAGE_RE = /^[a-z0-9-]{1,40}$/;
const MAX_BODY = 60000;
// ruta relativa o URL de nanoka (WuWa guarda la URL completa)
const ICON_RE = /^(?:[\w\-\/.]{0,120}|https:\/\/static\.nanoka\.cc\/[\w\-\/.]{1,160})$/;
const LIMITS = { cones: 5, arts: 4, orn: 3, echoes: 5 };
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function getChar(request) {
  const c = new URL(request.url).searchParams.get('c') || '';
  return PAGE_RE.test(c) ? c : null;
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

function cleanItems(a, k) {
  return (Array.isArray(a) ? a : []).slice(0, LIMITS[k]).map((x) => ({
    i: str(x && x.i, 12), n: str(x && x.n, 80), c: str(x && x.c, 200),
    p: x && [1, 2, 3, 4, 5].includes(x.p) ? x.p : undefined,       // WuWa usa 1, 2, 3 y 5 piezas
    cost: x && [1, 3, 4].includes(x.cost) ? x.cost : undefined,    // WuWa: coste del eco (1, 3 o 4)
  })).filter((x) => x.i && x.n && ICON_RE.test(x.c) && !x.c.includes('..'));
}

export default async function handler(request) {
  const c = getChar(request);
  const g = new URL(request.url).searchParams.get('g') || '';
  if (!c || !PAGE_RE.test(g)) return json({ error: 'personaje inválido' }, 400);

  if (request.method === 'GET') {
    const value = await redis.get('build:' + g + ':' + c);
    return json(value || {});
  }

  if (request.method === 'PUT') {
    if (!(await authorized(request))) return json({ error: 'no autorizado' }, 401);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'demasiado grande' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'JSON inválido' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'formato inválido' }, 400);
    const m = body.main && typeof body.main === 'object' ? body.main : {};
    const out = {
      cones: cleanItems(body.cones, 'cones'),
      arts: cleanItems(body.arts, 'arts'),
      orn: cleanItems(body.orn, 'orn'),
      echoes: cleanItems(body.echoes, 'echoes'),
      main: { torso: str(m.torso, 160), botas: str(m.botas, 160), botas2: str(m.botas2, 160), esfera: str(m.esfera, 160), esfera2: str(m.esfera2, 160), cuerda: str(m.cuerda, 160) },
      sub: str(body.sub, 160), talents: str(body.talents, 160), note: str(body.note, 160),
    };
    await redis.set('build:' + g + ':' + c, out);
    return json({ ok: true });
  }

  return json({ error: 'método no permitido' }, 405);
}
