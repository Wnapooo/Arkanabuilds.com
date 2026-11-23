// /api/img?u=<url>  Proxy de imágenes para poder generar la imagen descargable de la build
// (los CDN de iconos no permiten leerlos desde el navegador). Solo hosts de la lista.
export const config = { runtime: 'edge' };

const HOSTS = new Set([
  'static.nanoka.cc',
  'sr.yatta.moe',
  'cdn.jsdelivr.net',
  'raw.githubusercontent.com',
  'cdn.prydwen.gg',
]);
const MAX_BYTES = 6_000_000;

export default async function handler(request) {
  if (request.method !== 'GET') return new Response('método no permitido', { status: 405 });
  let target;
  try { target = new URL(new URL(request.url).searchParams.get('u') || ''); } catch { return new Response('url inválida', { status: 400 }); }
  if (target.protocol !== 'https:' || !HOSTS.has(target.hostname)) return new Response('host no permitido', { status: 403 });

  let upstream;
  try { upstream = await fetch(target.href, { redirect: 'manual', headers: { Accept: 'image/*' } }); }
  catch { return new Response('no se pudo cargar', { status: 502 }); }
  if (!upstream.ok) return new Response('no se pudo cargar', { status: 502 });

  const type = upstream.headers.get('content-type') || '';
  if (!/^image\//i.test(type)) return new Response('no es una imagen', { status: 415 });
  const len = Number(upstream.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return new Response('demasiado grande', { status: 413 });

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new Response('demasiado grande', { status: 413 });
  return new Response(buf, {
    status: 200,
    headers: { 'Content-Type': type, 'Cache-Control': 'public, s-maxage=86400, max-age=3600' },
  });
}
