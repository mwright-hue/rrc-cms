import express from 'express'
import morgan from 'morgan'
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import type { Request, Response } from 'express'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID as string
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME as string
const R2_S3_ENDPOINT = process.env.R2_S3_ENDPOINT as string
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID as string
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY as string

const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 86400)
const CACHE_TTL_IMMUTABLE = Number(process.env.CACHE_TTL_IMMUTABLE || 31536000)

const s3 = new S3Client({
  endpoint: R2_S3_ENDPOINT,
  forcePathStyle: true,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const app = express()
app.disable('x-powered-by')
app.use(morgan('tiny'))

const setCORS = (req: Request, res: Response) => {
  const origin = req.headers.origin
  if (origin && ALLOW_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

const isImmutable = (key: string) => /\.[a-f0-9]{8,}\./i.test(key)

const cacheControlFor = (key: string) => {
  return isImmutable(key)
    ? `public, max-age=${CACHE_TTL_IMMUTABLE}, immutable`
    : `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=604800`
}

app.get('/*', async (req: Request, res: Response) => {
  setCORS(req, res)
  const key = decodeURIComponent((req.path || '/').slice(1))
  if (!key) return res.status(400).json({ error: 'Missing key' })

  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
    const etag = head.ETag?.replace(/"/g, '')
    const lastModified = head.LastModified?.toUTCString()
    const ifNoneMatch = (req.headers['if-none-match'] || '').replace(/"/g, '')
    const ifModifiedSince = req.headers['if-modified-since']

    if (etag && ifNoneMatch && etag === ifNoneMatch) {
      res.status(304)
        .setHeader('ETag', etag)
        .setHeader('Last-Modified', lastModified || '')
        .setHeader('Cache-Control', cacheControlFor(key))
        .setHeader('Accept-Ranges', 'bytes')
        .end()
      return
    }

    if (lastModified && ifModifiedSince) {
      const since = new Date(ifModifiedSince)
      const lm = head.LastModified as Date
      if (!isNaN(since.getTime()) && lm <= since) {
        res.status(304)
          .setHeader('ETag', etag || '')
          .setHeader('Last-Modified', lastModified)
          .setHeader('Cache-Control', cacheControlFor(key))
          .setHeader('Accept-Ranges', 'bytes')
          .end()
        return
      }
    }

    const range = req.headers.range as string | undefined
    const getParams: any = { Bucket: R2_BUCKET_NAME, Key: key }
    if (range) getParams.Range = range
    const obj = await s3.send(new GetObjectCommand(getParams))

    const status = range ? 206 : 200
    if (obj.ETag) res.setHeader('ETag', obj.ETag.replace(/"/g, ''))
    if (obj.LastModified) res.setHeader('Last-Modified', (obj.LastModified as Date).toUTCString())
    res.setHeader('Accept-Ranges', 'bytes')
    if (obj.ContentRange) res.setHeader('Content-Range', obj.ContentRange)
    if (obj.ContentLength != null) res.setHeader('Content-Length', String(obj.ContentLength))
    if (obj.ContentType) res.setHeader('Content-Type', obj.ContentType)
    res.setHeader('Cache-Control', cacheControlFor(key))

    // stream body
    const body = obj.Body as any
    if (body && typeof body.pipe === 'function') {
      res.status(status)
      body.pipe(res)
    } else {
      const buf = await obj.Body?.transformToByteArray?.()
      res.status(status).send(Buffer.from(buf || []))
    }
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
      res.setHeader('Cache-Control', 'public, max-age=60')
      return res.status(404).json({ error: 'Not found' })
    }
    console.error('Proxy error', err)
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.status(502).json({ error: 'Upstream error' })
  }
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Media proxy listening on :${PORT}`)
})
