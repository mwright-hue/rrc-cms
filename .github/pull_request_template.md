## Summary

Finalize Ridge & Root CMS with R2 media storage, proxy delivery, webhooks/scheduler, search, and roles.

## How to run locally

- CMS (root)
  - Install: `npm install`
  - Typecheck: `npm run typecheck`
  - Start: `npm start` (or `npm run dev` for watch)

- Media Proxy (`proxy/`)
  - Install: `cd proxy && npm install`
  - Build: `cd proxy && npm run build`
  - Start: `cd proxy && npm start`

Note: Configure all env vars in your runtime (Render/Netlify/Cloudflare). Do not commit secrets. `.env.example` lists variable names only.

## Smoke test checklist

- [ ] Media upload stores in R2 with key pattern `YYYY/MM/<slug>-<uuid>.<ext>`
- [ ] Media URL persisted with `MEDIA_BASE_URL/...`
- [ ] Draft Post is not returned by public API
- [ ] Publish Post triggers Netlify build hook (logs)
- [ ] Future `publishedAt` auto-publishes and sends `scheduled` event
- [ ] `?q=` search finds phrases from rich text
- [ ] Proxy serves asset with headers: `ETag`, `Last-Modified`, `Accept-Ranges`, `Content-Type`, `Cache-Control`
- [ ] Proxy returns `304` on conditional and `206` on range requests

## Notes

- CORS: `ridgeandrootcreative.com`, `www`, and `cms` hosts allowed.
- Rate limit: 60 req/min/IP (in-memory) — consider shared store for multi-instance.
- Secrets handling: never commit; rotate if exposed.

