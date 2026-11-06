# ArkanaBuilds — versión Vercel

Migración del Cloudflare Worker original a Vercel. Las 5 rutas de API
(`/api/layout`, `/api/teams`, `/api/dupes`, `/api/builds`, `/api/zzz-catalog`)
quedaron como **Edge Functions** independientes en la carpeta `/api`, y el
almacenamiento KV de Cloudflare (`TIERLIST`) pasó a **Vercel KV**.

## 1. Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Migración desde Cloudflare Worker"
```

Creá un repo en GitHub y subí este código ahí (`git remote add origin ...` y `git push`).

## 2. Crear el proyecto en Vercel

En [vercel.com](https://vercel.com) → **Add New Project** → importá el repo.
No hace falta configurar build command ni output directory: es un sitio
estático con funciones en `/api`, Vercel lo detecta solo.

## 3. Crear el KV Store (reemplazo de TIERLIST)

1. Dentro del proyecto en Vercel: pestaña **Storage** → **Create Database** → **KV**.
2. Ponele un nombre (ej. `tierlist`) y conectalo al proyecto (esto agrega
   automáticamente las variables `KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.
   a tu proyecto — no hay que tocarlas a mano).

> Los datos viejos que tenías en el KV de Cloudflare **no se copian solos**.
> Si querés migrar el contenido existente (layouts, teams, dupes, builds ya
> guardados), avisame y armamos un script aparte para exportarlos de
> Cloudflare e importarlos a Vercel KV.

## 4. Configurar el secreto ADMIN_KEY

Settings → **Environment Variables** → agregá:

- Name: `ADMIN_KEY`
- Value: el mismo valor que usabas en Cloudflare (o uno nuevo)
- Marcá los 3 entornos: Production, Preview, Development

## 5. Deploy

Con eso ya podés hacer **Deploy**. Vercel te da una URL tipo
`arkanabuilds.vercel.app`. Para tu dominio propio: Settings → Domains.

## Notas técnicas de la migración

- El Worker original comparaba el `ADMIN_KEY` con hash SHA-256 en tiempo
  constante — se mantuvo exactamente igual.
- Las funciones corren en el **Edge Runtime** de Vercel (no Node.js) porque
  usan las mismas APIs web (`Request`, `Response`, `crypto.subtle`) que
  Cloudflare Workers — por eso el puerto fue casi 1:1.
- `env.ASSETS.fetch(request)` (que en Cloudflare servía los archivos
  estáticos) ya no hace falta: Vercel sirve automáticamente los `.html`
  de la raíz del proyecto.
- La opción `cf: { cacheTtl, cacheEverything }` de la llamada a nanoka.cc
  no existe en Vercel; se reemplazó por el header `Cache-Control` normal,
  que cumple la misma función de cacheo.
