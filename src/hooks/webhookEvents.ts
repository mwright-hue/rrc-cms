import type { CollectionAfterChangeHook } from 'payload/types'
import { buildHookBody, sendNetlifyHook } from '../utils/webhooks'

export const netlifyPublishHooks = (collectionSlug: string, slugField = 'slug'): CollectionAfterChangeHook => {
  return async ({ doc, previousDoc }) => {
    if (!process.env.NETLIFY_BUILD_HOOK_URL) return
    const prevStatus = previousDoc?._status
    const nextStatus = doc?._status

    let event: 'published' | 'updated' | 'unpublished' | null = null
    if (prevStatus !== 'published' && nextStatus === 'published') event = 'published'
    else if (prevStatus === 'published' && nextStatus !== 'published') event = 'unpublished'
    else if (nextStatus === 'published') event = 'updated'

    if (!event) return
    const body = buildHookBody({
      collection: collectionSlug,
      id: String(doc.id),
      slug: (doc as any)[slugField],
      event,
    })
    await sendNetlifyHook(body)
  }
}

