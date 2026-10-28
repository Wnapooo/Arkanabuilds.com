// Cloudflare Pages Function  ->  /api/teams?c=<slug>
// Mismo estilo que layout.js. Requiere: KV binding "TIERLIST" y secreto "ADMIN_KEY".
// Guarda en la clave "teams:<slug>" (no toca "layout:<page>").

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;
const MAX_BODY = 20000;
const MAX_TEAMS = 8;
const MAX_MEMBERS = 4;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function getSlug(request) {
  const c = new URL(request.url).searchParams.get('c') || '';
  return SLUG_RE.test(c) ? c : null;
}

// Comparación en tiempo constante (compara hashes SHA-256)
async function authorized(request, env) {
  const header = request.headers.get('Authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!env.ADMIN_KEY || !given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_KEY)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function valid(body) {
  if (!body || !Array.isArray(body.teams) || body.teams.length > MAX_TEAMS) return false;
  return body.teams.every(
    (t) =>
      t &&
      typeof t.n === 'string' && t.n.length <= 40 &&
      Array.isArray(t.m) && t.m.length >= 1 && t.m.length <= MAX_MEMBERS &&
      t.m.every((s) => typeof s === 'string' && SLUG_RE.test(s))
  );
}

export async function onRequestGet({ request, env }) {
  const slug = getSlug(request);
  if (!slug) return json({ error: 'personaje inválido' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  const value = await env.TIERLIST.get('teams:' + slug);
  if (!value) return json(null, 404);
  return new Response(value, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequestPut({ request, env }) {
  if (!(await authorized(request, env))) return json({ error: 'no autorizado' }, 401);
  const slug = getSlug(request);
  if (!slug) return json({ error: 'personaje inválido' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'demasiado grande' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!valid(body)) return json({ error: 'formato inválido' }, 400);
  if (body.teams.length === 0) await env.TIERLIST.delete('teams:' + slug);
  else await env.TIERLIST.put('teams:' + slug, JSON.stringify({ teams: body.teams }));
  return json({ ok: true });
}
