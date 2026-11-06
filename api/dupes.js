// /api/dupes?g=<juego>&c=<slug>
export const config = { runtime: 'edge' };

import { kv } from '@vercel/kv';

const PAGE_RE = /^[a-z0-9-]{1,40}$/;
const MAX_BODY = 60000;
const MAX_DUPES = 600;

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

export default async function handler(request) {
  const c = getChar(request);
  const g = new URL(request.url).searchParams.get('g') || '';
  if (!c || !PAGE_RE.test(g)) return json({ error: 'personaje inválido' }, 400);

  if (request.method === 'GET') {
    const value = await kv.get('dupes:' + g + ':' + c);
    return json(value || { text: '' });
  }

  if (request.method === 'PUT') {
    if (!(await authorized(request))) return json({ error: 'no autorizado' }, 401);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'demasiado grande' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'JSON inválido' }, 400); }
    if (!body || typeof body.text !== 'string') return json({ error: 'formato inválido' }, 400);
    const clean = body.text.slice(0, MAX_DUPES);
    if (clean.trim()) await kv.set('dupes:' + g + ':' + c, { text: clean });
    else await kv.del('dupes:' + g + ':' + c);
    return json({ ok: true });
  }

  return json({ error: 'método no permitido' }, 405);
}
