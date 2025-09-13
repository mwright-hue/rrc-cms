import type { PayloadConfig } from 'payload/types'
import { postgresAdapter } from '@payloadcms/db-postgres'

import Users from './src/collections/Users'
import Media from './src/collections/Media'
import Pages from './src/collections/Pages'
import Posts from './src/collections/Posts'
import CaseStudies from './src/collections/CaseStudies'
import SiteSettings from './src/globals/SiteSettings'
import SEODefaults from './src/globals/SEODefaults'
import { startScheduler } from './src/utils/scheduler'

type CloudPluginModule = any

async function loadCloudStorage(): Promise<{
  cloudStorageFn: Function
  s3AdapterFactory: Function
} | null> {
  // Try the root plugin first
  let mod: CloudPluginModule | null = null
  try {
    mod = await import('@payloadcms/plugin-cloud-storage')
  } catch {
    mod = null
  }
  if (!mod) return null
  const cloudStorageFn: any = mod.cloudStorage || (mod as any).default || (mod as any)
  if (typeof cloudStorageFn !== 'function') return null

  // Try to find the S3 adapter across known subpaths/fields
  const candidates = [
    '@payloadcms/plugin-cloud-storage/s3',
    '@payloadcms/plugin-cloud-storage/adapter/s3',
    '@payloadcms/plugin-cloud-storage/adapters/s3',
    '@payloadcms/plugin-cloud-storage/adapter-s3',
  ]
  let s3AdapterFactory: any = null
  for (const p of candidates) {
    try {
      const s3mod: any = await import(p)
      s3AdapterFactory = s3mod?.default || s3mod?.s3Adapter || s3mod
      if (typeof s3AdapterFactory === 'function') break
    } catch {
      // continue
    }
  }
  if (!s3AdapterFactory) {
    s3AdapterFactory = mod.s3Adapter || mod.adapters?.s3?.s3Adapter || mod.adapters?.s3?.default || mod.adapters?.s3
  }
  if (typeof s3AdapterFactory !== 'function') return null

  return { cloudStorageFn, s3AdapterFactory }
}

const cloud = await loadCloudStorage()

const allowedOrigins = [
  'https://ridgeandrootcreative.com',
  'https://www.ridgeandrootcreative.com',
  'https://cms.ridgeandrootcreative.com',
]

const r2Adapter = cloud
  ? cloud.s3AdapterFactory({
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
      generateFileKey: ({ filename, size }: { filename: string; size?: unknown }) => {
        const now = new Date()
        const yyyy = now.getUTCFullYear()
        const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
        const base = (filename || 'file').replace(/\.[^.]+$/, '')
        const slug = base.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
        const ext = (filename.match(/\.([^.]+)$/)?.[1] || 'bin').toLowerCase()
        const uuid = Math.random().toString(36).slice(2, 10)
        const folder = `${yyyy}/${mm}`
        const key = `${folder}/${slug}-${uuid}.${ext}`
        if (size) return `thumbs/${key}`
        return key
      },
      generateFileURL: ({ filename }: { filename: string }) => {
        const base = process.env.MEDIA_BASE_URL || 'https://media.ridgeandrootcreative.com'
        return `${base}/${filename}`
      },
      uploadOptions: ({ filename }: { filename?: string }) => {
        const immutable = /\.[a-f0-9]{8,}\./i.test(filename || '')
        const cc = immutable
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=86400, stale-while-revalidate=604800'
        return { CacheControl: cc }
      },
    })
  : null

const config: PayloadConfig = {
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL as string,
    },
  }),
  serverURL: process.env.SERVER_URL,
  localization: { locales: ['en-US'], defaultLocale: 'en-US' },
  admin: {
    user: Users.slug,
    meta: { titleSuffix: 'Ridge & Root CMS' },
  },
  csrf: allowedOrigins,
  cors: allowedOrigins,
  collections: [Users, Media, Pages, Posts, CaseStudies],
  globals: [SiteSettings, SEODefaults],
  graphQL: { disable: false },
  rateLimit: { trustProxy: true },
  hooks: {
    afterInit: [async (payload) => {
      startScheduler(payload)
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
    ...(cloud && r2Adapter
      ? [
          (cloud.cloudStorageFn as any)({
            collections: {
              media: {
                adapter: r2Adapter,
                disableLocalStorage: true,
              },
            },
          }),
        ]
      : []),
  ],
}

export default config

