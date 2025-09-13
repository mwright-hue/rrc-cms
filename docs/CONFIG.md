Ridge & Root CMS — Phase 5

Environment variables (Payload service)

- `PAYLOAD_SECRET` — Payload auth/session secret.
- `DATABASE_URL` — Postgres connection string.
- `SERVER_URL` — External URL of the CMS (optional).
- `TRUST_PROXY` — `true` when running behind a proxy/load balancer (optional).
- `MEDIA_BASE_URL` — Public media origin, e.g. `https://media.ridgeandrootcreative.com`.
- `NETLIFY_BUILD_HOOK_URL` — Netlify build hook endpoint.
- `NETLIFY_BUILD_HOOK_SECRET` — Secret appended as `?secret=...` and validated by Netlify function/site (optional).
- Cloudflare R2 (S3 API):
  - `R2_ACCOUNT_ID`
  - `R2_BUCKET_NAME`
  - `R2_S3_ENDPOINT` (e.g., `https://<account>.r2.cloudflarestorage.com`)
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`

Secrets handling

- Never commit secrets or real values to the repository, PRs, or comments.
- Only configure secrets in Render/Cloudflare/Netlify environment settings.
- This repo includes `.env.example` listing variable names for reference — do not add values.
- If a secret is ever exposed, immediately rotate it (R2 keys, DB password, Netlify hook URL/secret, etc.).
- If secrets were accidentally committed, scrub them from git history using `git filter-repo` or BFG, then rotate the impacted credentials.

Environment variables (Media Proxy service)

- `PORT` — Port to listen on (default 3000).
- `ALLOW_ORIGINS` — CSV of allowed origins for CORS.
- `CACHE_TTL_SECONDS` — Default TTL for non-immutable assets (default 86400).
- `CACHE_TTL_IMMUTABLE` — TTL for immutable assets (default 31536000).
- Same R2 S3 API vars as above: `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_S3_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

Cloudflare R2 storage

- Uses `@payloadcms/plugin-cloud-storage` with S3 adapter.
- Originals stored under `YYYY/MM/<slug>-<uuid>.<ext>`.
- Thumbnails stored under `thumbs/` with the same folder and filename pattern.
- Sizes: 320, 640, 1280, 1920 long-edge (width-driven), plus `og` at 1200x630. WebP variants are generated as well.
- Public URLs persisted as absolute `MEDIA_BASE_URL + '/' + key` — no raw R2 endpoints.
- Cache headers on objects:
  - Default: `public, max-age=86400, stale-while-revalidate=604800`.
  - Hashed filenames (e.g. `name.abcdef12.ext`): `public, max-age=31536000, immutable`.

Media proxy

- Service in `proxy/` streams from R2 using AWS SDK v3.
- Routes:
  - `GET /health` → `{ ok: true }`.
  - `GET /:key*` → serves object with headers: `ETag`, `Last-Modified`, `Accept-Ranges`, `Content-Type`, `Cache-Control`.
  - Supports conditional requests (`If-None-Match`, `If-Modified-Since` → `304`) and range requests (`206`).
  - CORS: `Access-Control-Allow-Origin` from `ALLOW_ORIGINS`, `Vary: Origin`.
  - 404 sets a brief cache; 5xx sets short cache.

Search

- Posts: `searchText` contains plain text extracted from `body` (rich text).
- Case Studies: `searchText` contains `clientName`, `summary`, and extracted text from `challenge`, `approach`, `outcome`.
- Text indexes on `title`, `excerpt`, and `searchText`.
- REST supports `?q=` param on Posts and Case Studies; filters across those fields.

Webhooks & scheduling

- In-process scheduler checks every minute; when `publishedAt <= now` and `_status='published'`, fires a Netlify hook with event `scheduled` and sets `lastPublishEventAt`.
- Netlify events: `published`, `updated` (while published), `unpublished`, `scheduled`.
- Body: `{ collection, id, slug, event, timestamp }`.
- Idempotency: duplicates (same doc+event) within 2 minutes are skipped in memory.
- Retry/backoff: up to 3 attempts over ~5 minutes total.
- Secret: if `NETLIFY_BUILD_HOOK_SECRET` provided, it is appended as a query param.

Roles / access

- Admin: full access including Users and Globals.
- Editor: full content; publish; delete content; no Users.
- Author: create/edit own Posts; drafts only; cannot publish; cannot set `publishedAt` in the past; upload Media; Pages drafts only; no Case Studies.
- Marketing: edit text/media on published Pages/Posts/Case Studies; cannot change slug, author, status, or `publishedAt`; cannot delete.
- Public API guard: only `_status='published'` and `publishedAt <= now` exposed.

CORS & rate limiting

- Allowed origins: `https://ridgeandrootcreative.com`, `https://www.ridgeandrootcreative.com`, `https://cms.ridgeandrootcreative.com`.
- Public API rate limit: 60 req/min/IP (in-memory). For multi-instance or serverless, use a shared store (e.g., Redis) — replace the in-memory bucket in `src/payload.config.ts`.

Operational notes

- Rotate R2 keys: create new key pair, deploy updated env vars, verify, then remove old keys.
- Change thumbnail sizes: adjust `imageSizes` in `src/collections/Media.ts`. To rename sizes, consider migration for existing keys.
- Adjust cache TTLs: change logic in `uploadOptions` (CMS) and `cacheControlFor` (proxy) for immutable/non-immutable.
- Update CORS origins: edit allowlists in `src/payload.config.ts` and `proxy` `ALLOW_ORIGINS` env.
- Change Netlify hook URL or secret: update `NETLIFY_BUILD_HOOK_URL` and `NETLIFY_BUILD_HOOK_SECRET`. Netlify side should validate the secret if used.
- Add or tweak roles/guards: edit helpers in `src/access/roles.ts` and per-collection `access` and `beforeChange` hooks.
