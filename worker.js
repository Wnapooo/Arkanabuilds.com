// Cloudflare Worker  ->  /api/layout?page=wuwa, /api/teams?c=<slug> /api/dupes y /api/builds?g=<juego>&c=<slug>  (todo lo demás lo sirven los archivos del sitio)
// Requiere: KV binding "TIERLIST" y secreto "ADMIN_KEY".

const PAGE_RE = /^[a-z0-9-]{1,40}$/;
const SAFE_PATH = /^\.\/[\w\-.\/#]{1,150}$/;
const MAX_BODY = 60000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function getPage(request) {
  const page = new URL(request.url).searchParams.get('page') || '';
  return PAGE_RE.test(page) ? page : null;
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
  if (!body || typeof body.base !== 'string' || body.base.length > 40) return false;
  if (!Array.isArray(body.layout) || body.layout.length > 60) return false;
  return body.layout.every(
    (row) =>
      Array.isArray(row) &&
      row.length <= 200 &&
      row.every(
        (it) =>
          it &&
          typeof it.h === 'string' && SAFE_PATH.test(it.h) &&
          typeof it.s === 'string' && SAFE_PATH.test(it.s) &&
          typeof it.t === 'string' && it.t.length <= 100
      )
  );
}

async function onRequestGet({ request, env }) {
  const page = getPage(request);
  if (!page) return json({ error: 'page inválida' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  const value = await env.TIERLIST.get('layout:' + page);
  if (!value) return json(null, 404);
  return new Response(value, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function onRequestPut({ request, env }) {
  if (!(await authorized(request, env))) return json({ error: 'no autorizado' }, 401);
  const page = getPage(request);
  if (!page) return json({ error: 'page inválida' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'demasiado grande' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!valid(body)) return json({ error: 'formato inválido' }, 400);
  await env.TIERLIST.put('layout:' + page, JSON.stringify({ base: body.base, layout: body.layout }));
  return json({ ok: true });
}

async function onRequestDelete({ request, env }) {
  if (!(await authorized(request, env))) return json({ error: 'no autorizado' }, 401);
  const page = getPage(request);
  if (!page) return json({ error: 'page inválida' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  await env.TIERLIST.delete('layout:' + page);
  return json({ ok: true });
}

/* ---------------- EQUIPOS: /api/teams?c=<slug> ---------------- */
const MAX_TEAMS = 8, MAX_TEAM = 4;

function getChar(request) {
  const c = new URL(request.url).searchParams.get('c') || '';
  return PAGE_RE.test(c) ? c : null;
}

async function teamsGet({ request, env }) {
  const c = getChar(request);
  if (!c) return json({ error: 'personaje inválido' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  const value = await env.TIERLIST.get('teams:' + c);
  return new Response(value || JSON.stringify({ teams: [] }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function teamsPut({ request, env }) {
  if (!(await authorized(request, env))) return json({ error: 'no autorizado' }, 401);
  const c = getChar(request);
  if (!c) return json({ error: 'personaje inválido' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'demasiado grande' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!body || !Array.isArray(body.teams)) return json({ error: 'formato inválido' }, 400);
  const teams = body.teams.slice(0, MAX_TEAMS).map((t) => ({
    n: t && typeof t.n === 'string' ? t.n.slice(0, 40) : '',
    m: (t && Array.isArray(t.m) ? t.m : [])
      .filter((s) => typeof s === 'string' && PAGE_RE.test(s))
      .slice(0, MAX_TEAM),
  }));
  await env.TIERLIST.put('teams:' + c, JSON.stringify({ teams }));
  return json({ ok: true });
}

/* ---------------- DUPES: /api/dupes?g=<juego>&c=<slug> ---------------- */
const MAX_DUPES = 600;

async function dupesGet({ request, env }) {
  const c = getChar(request);
  const g = new URL(request.url).searchParams.get('g') || '';
  if (!c || !PAGE_RE.test(g)) return json({ error: 'personaje inválido' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  const value = await env.TIERLIST.get('dupes:' + g + ':' + c);
  return new Response(value || JSON.stringify({ text: '' }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function dupesPut({ request, env }) {
  if (!(await authorized(request, env))) return json({ error: 'no autorizado' }, 401);
  const c = getChar(request);
  const g = new URL(request.url).searchParams.get('g') || '';
  if (!c || !PAGE_RE.test(g)) return json({ error: 'personaje inválido' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'demasiado grande' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!body || typeof body.text !== 'string') return json({ error: 'formato inválido' }, 400);
  const clean = body.text.slice(0, MAX_DUPES);
  if (clean.trim()) await env.TIERLIST.put('dupes:' + g + ':' + c, JSON.stringify({ text: clean }));
  else await env.TIERLIST.delete('dupes:' + g + ':' + c);
  return json({ ok: true });
}

/* ---------------- BUILDS: /api/builds?g=<juego>&c=<slug> ---------------- */
const ICON_RE = /^(?:[\w\-\/.]{0,120}|https:\/\/static\.nanoka\.cc\/[\w\-\/.]{1,160})$/;  // ruta relativa o URL de nanoka (WuWa guarda la URL completa)
const LIMITS = { cones: 5, arts: 4, orn: 3 };
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

function cleanItems(a, k) {
  return (Array.isArray(a) ? a : []).slice(0, LIMITS[k]).map((x) => ({
    i: str(x && x.i, 12), n: str(x && x.n, 80), c: str(x && x.c, 200),
    p: x && [1, 2, 3, 4, 5].includes(x.p) ? x.p : undefined,  // WuWa usa 1, 2, 3 y 5 piezas
  })).filter((x) => x.i && x.n && ICON_RE.test(x.c) && !x.c.includes('..'));
}

async function buildsGet({ request, env }) {
  const c = getChar(request);
  const g = new URL(request.url).searchParams.get('g') || '';
  if (!c || !PAGE_RE.test(g)) return json({ error: 'personaje inválido' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
  const value = await env.TIERLIST.get('build:' + g + ':' + c);
  return new Response(value || '{}', {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function buildsPut({ request, env }) {
  if (!(await authorized(request, env))) return json({ error: 'no autorizado' }, 401);
  const c = getChar(request);
  const g = new URL(request.url).searchParams.get('g') || '';
  if (!c || !PAGE_RE.test(g)) return json({ error: 'personaje inválido' }, 400);
  if (!env.TIERLIST) return json({ error: 'KV TIERLIST no configurado' }, 500);
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
    main: { torso: str(m.torso, 160), botas: str(m.botas, 160), esfera: str(m.esfera, 160), cuerda: str(m.cuerda, 160) },
    sub: str(body.sub, 160), talents: str(body.talents, 160), note: str(body.note, 160),
  };
  await env.TIERLIST.put('build:' + g + ':' + c, JSON.stringify(out));
  return json({ ok: true });
}

/* ---------------- ZZZ: /api/zzz-catalog (motores-W y discos desde nanoka) ---------------- */
const NANOKA = 'https://static.nanoka.cc';
const bareName = (p) => String(p || '').split('/').pop().replace(/\.[a-z0-9]+$/i, '');
const nameOf = (x) => {
  const v = x && (x.en || x.zh || x.name);
  return typeof v === 'string' ? v : (v && v.name) || '';
};

async function zzzCatalog() {
  try {
    const opt = { cf: { cacheTtl: 3600, cacheEverything: true } };
    const man = await (await fetch(NANOKA + '/manifest.json', opt)).json();
    const ver = man && man.zzz && man.zzz.live;
    if (!ver) return json({ error: 'sin versión' }, 502);
    const [w, e] = await Promise.all(['weapon', 'equipment'].map((f) =>
      fetch(NANOKA + '/zzz/' + ver + '/' + f + '.json', opt).then((r) => (r.ok ? r.json() : Promise.reject()))));
    const lst = (o) => Object.entries(o || {})
      .map(([i, x]) => ({ i: String(i), n: nameOf(x).slice(0, 80), c: bareName(x && x.icon).slice(0, 100) }))
      .filter((x) => x.n);
    return new Response(JSON.stringify({ cones: lst(w), sets: lst(e) }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
    });
  } catch {
    return json({ error: 'catálogo no disponible' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/layout') {
      const ctx = { request, env };
      switch (request.method) {
        case 'GET': return onRequestGet(ctx);
        case 'PUT': return onRequestPut(ctx);
        case 'DELETE': return onRequestDelete(ctx);
        default: return json({ error: 'método no permitido' }, 405);
      }
    }
    if (url.pathname === '/api/teams') {
      const ctx = { request, env };
      switch (request.method) {
        case 'GET': return teamsGet(ctx);
        case 'PUT': return teamsPut(ctx);
        default: return json({ error: 'método no permitido' }, 405);
      }
    }
    if (url.pathname === '/api/dupes') {
      const ctx = { request, env };
      switch (request.method) {
        case 'GET': return dupesGet(ctx);
        case 'PUT': return dupesPut(ctx);
        default: return json({ error: 'método no permitido' }, 405);
      }
    }
    if (url.pathname === '/api/zzz-catalog' && request.method === 'GET') return zzzCatalog();
    if (url.pathname === '/api/builds') {
      const ctx = { request, env };
      switch (request.method) {
        case 'GET': return buildsGet(ctx);
        case 'PUT': return buildsPut(ctx);
        default: return json({ error: 'método no permitido' }, 405);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
