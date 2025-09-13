import type { PayloadConfig } from 'payload/types'
import cloudStorage, { s3Adapter } from '@payloadcms/plugin-cloud-storage'
import Users from './src/collections/Users'
import Media from './src/collections/Media'
import Pages from './src/collections/Pages'
import Posts from './src/collections/Posts'
import CaseStudies from './src/collections/CaseStudies'
import SiteSettings from './src/globals/SiteSettings'
import SEODefaults from './src/globals/SEODefaults'
import { startScheduler } from './src/utils/scheduler'

const allowedOrigins = [
  'https://ridgeandrootcreative.com',
  'https://www.ridgeandrootcreative.com',
  'https://cms.ridgeandrootcreative.com',
]

const r2Adapter = s3Adapter({
  config: {
    endpoint: process.env.R2_S3_ENDPOINT as string,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  },
  bucket: process.env.R2_BUCKET_NAME as string,
  acl: 'private',
  generateFileKey: ({ filename, prefix, size, doc }) => {
    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    // slug-ish from filename base
    const base = (filename || 'file').replace(/\.[^.]+$/, '')
    const slug = base.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
    const ext = (filename.match(/\.([^.]+)$/)?.[1] || 'bin').toLowerCase()
    const uuid = Math.random().toString(36).slice(2, 10)
    const folder = `${yyyy}/${mm}`
    const key = `${folder}/${slug}-${uuid}.${ext}`
    if (size) {
      return `thumbs/${key}`
    }
    return key
  },
  generateFileURL: ({ filename }) => {
    const base = process.env.MEDIA_BASE_URL || 'https://media.ridgeandrootcreative.com'
    return `${base}/${filename}`
  },
  uploadOptions: ({ filename }) => {
    const immutable = /\.[a-f0-9]{8,}\./i.test(filename || '')
    const cc = immutable
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400, stale-while-revalidate=604800'
    return { CacheControl: cc }
  },
})

const config: PayloadConfig = {
  serverURL: process.env.SERVER_URL,
  // Project conventions
  localization: { locales: ['en-US'], defaultLocale: 'en-US' },
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: 'Ridge & Root CMS',
    },
    components: {
      graphics: {
        Logo: undefined as any, // Logo comes from Site Settings in UI, keep default
        Icon: undefined as any,
      },
    },
  },
  csrf: allowedOrigins,
  cors: allowedOrigins,
  collections: [Users, Media, Pages, Posts, CaseStudies],
  globals: [SiteSettings, SEODefaults],
  typescript: { outputFile: process.env.PAYLOAD_TYPES_OUT || undefined },
  graphQL: { disable: false },
  rateLimit: { trustProxy: true },
  hooks: {
    afterInit: [async (payload) => {
      // Start publish scheduler for time-based publishing and Netlify hook
      startScheduler(payload)

      // Simple in-memory public API rate limit: 60 req/min per IP
      const buckets = new Map<string, { count: number; resetAt: number }>()
      const windowMs = 60_000
      const max = 60
      payload.express?.use((req, res, next) => {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'anon'
        const now = Date.now()
        const b = buckets.get(ip) || { count: 0, resetAt: now + windowMs }
        if (now > b.resetAt) {
          b.count = 0
          b.resetAt = now + windowMs
        }
        b.count += 1
        buckets.set(ip, b)
        if (b.count > max) {
          res.status(429).json({ error: 'Rate limit exceeded' })
          return
        }
        next()
      })
    }],
  },
  plugins: [
    cloudStorage({
      collections: {
        media: {
          adapter: r2Adapter,
          disableLocalStorage: true,
        },
      },
    }),
  ],
}

export default config
