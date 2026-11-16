// /api/banners?g=wuwa   ->  guarda y entrega los banners manuales (Wuthering Waves)
// Mismo estilo que dupes.js. Requiere: Upstash Redis (ya conectado) y la variable ADMIN_KEY.
export const config = { runtime: 'edge' };

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
});

const PAGE_RE = /^[a-z0-9-]{1,40}$/;
const MAX_BODY = 600000;       // incluye imágenes subidas (se reducen a 256px en el navegador)
const MAX_BANNERS = 12;
const SAFE_IMG = /^(\.\/[\w\-.\/ ()%#]{1,150}|https:\/\/[^\s"'<>]{1,400}|data:image\/(png|webp|jpeg|gif);base64,[A-Za-z0-9+\/=]{1,200000})$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function getPage(request) {
  const g = new URL(request.url).searchParams.get('g') || '';
  return PAGE_RE.test(g) ? g : null;
}

// Comparación en tiempo constante (compara hashes SHA-256)
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

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const img = (v) => (typeof v === 'string' && SAFE_IMG.test(v) ? v : '');
const date = (v) => (typeof v === 'string' && SAFE_DATE.test(v) ? v : '');

// Devuelve solo los campos conocidos y válidos (nada más se guarda)
function clean(body) {
  if (!body || !Array.isArray(body.banners) || body.banners.length > MAX_BANNERS) return null;
  return {
    banners: body.banners.map((b) => ({
      id: str(b && b.id, 40),
      kind: b && b.kind === 'weapon' ? 'weapon' : 'char',
      version: str(b && b.version, 20),
      name: str(b && b.name, 100),
      weaponName: str(b && b.weaponName, 100),
      icon: img(b && b.icon),
      weaponIcon: img(b && b.weaponIcon),
      element: img(b && b.element),
      start: date(b && b.start),
      end: date(b && b.end),
    })),
    updated: new Date().toISOString(),
  };
}

export default async function handler(request) {
  const g = getPage(request);
  if (!g) return json({ error: 'página inválida' }, 400);

  if (request.method === 'GET') {
    const value = await redis.get('banners:' + g);
    return json(value || { banners: [] });
  }

  if (request.method === 'PUT') {
    if (!(await authorized(request))) return json({ error: 'no autorizado' }, 401);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'demasiado grande' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'JSON inválido' }, 400); }
    const data = clean(body);
    if (!data) return json({ error: 'formato inválido' }, 400);
    await redis.set('banners:' + g, data);
    return json({ ok: true });
  }

  return json({ error: 'método no permitido' }, 405);
}
