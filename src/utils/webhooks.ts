type NetlifyEvent = 'published' | 'updated' | 'unpublished' | 'scheduled'

const NETLIFY_URL = process.env.NETLIFY_BUILD_HOOK_URL || ''
const NETLIFY_SECRET = process.env.NETLIFY_BUILD_HOOK_SECRET || ''

const sentCache = new Map<string, number>() // key -> expiry ms

const pruneCache = () => {
  const now = Date.now()
  for (const [k, v] of sentCache.entries()) if (v <= now) sentCache.delete(k)
}

export const sendNetlifyHook = async (payload: Record<string, any>, attempt = 1): Promise<void> => {
  if (!NETLIFY_URL) return
  // Idempotency: skip if same payload already sent in last 2 minutes
  const key = `${payload.collection}:${payload.id}:${payload.event}`
  const now = Date.now()
  pruneCache()
  const prev = sentCache.get(key)
  if (prev && prev > now) return

  const url = NETLIFY_SECRET ? `${NETLIFY_URL}?secret=${encodeURIComponent(NETLIFY_SECRET)}` : NETLIFY_URL
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Hook failed: ${res.status}`)
    sentCache.set(key, now + 2 * 60_000)
  } catch (err) {
    if (attempt < 3) {
      const delays = [30_000, 120_000, 180_000]
      const delay = delays[attempt - 1] || 180_000
      await new Promise((r) => setTimeout(r, delay))
      return sendNetlifyHook(payload, attempt + 1)
    }
    console.error('Netlify hook error', err)
  }
}

export const buildHookBody = (args: {
  collection: string
  id: string
  slug?: string
  event: NetlifyEvent
}): Record<string, any> => ({
  ...args,
  timestamp: new Date().toISOString(),
})
