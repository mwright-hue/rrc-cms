import type { Payload } from 'payload'
import { buildHookBody, sendNetlifyHook } from './webhooks'

const collections = [
  { slug: 'posts', slugField: 'slug' },
  { slug: 'pages', slugField: 'slug' },
  { slug: 'case-studies', slugField: 'clientName' },
]

export const startScheduler = (payload: Payload) => {
  // Poll every minute to emit publish webhooks for newly effective scheduled content
  const intervalMs = 60_000
  const tick = async () => {
    const now = new Date().toISOString()
    for (const c of collections) {
      try {
        const res = await payload.find({
          collection: c.slug,
          depth: 0,
          where: {
            and: [
              { _status: { equals: 'published' } },
              { publishedAt: { less_than_equal: now } },
              {
                or: [
                  { lastPublishEventAt: { exists: false } },
                  { lastPublishEventAt: { less_than: ['publishedAt'] as any } },
                ],
              },
            ],
          },
          limit: 50,
        })
        for (const doc of res.docs) {
          const body = buildHookBody({
            collection: c.slug,
            id: String(doc.id),
            slug: (doc as any)[c.slugField],
            event: 'scheduled',
          })
          await sendNetlifyHook(body)
          await payload.update({
            collection: c.slug,
            id: String(doc.id),
            data: { lastPublishEventAt: doc.publishedAt },
            depth: 0,
          })
        }
      } catch (e) {
        console.error('Scheduler tick error', c.slug, e)
      }
    }
  }

  // Initial delay to let Payload boot
  setTimeout(() => {
    tick()
    setInterval(tick, intervalMs)
  }, 5000)
}
