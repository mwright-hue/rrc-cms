import type { CollectionConfig } from 'payload/types'
import { hasRole, isOwn, publishedReadAccess } from '../access/roles'
import { SEOFields } from '../fields/SEOFields'
import { netlifyPublishHooks } from '../hooks/webhookEvents'
import { extractPlainText } from '../utils/richText'

const wordsPerMinute = 200

const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Post', plural: 'Posts' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'author', 'publishedAt', '_status'],
    defaultSort: '-publishedAt',
  },
  versions: { drafts: true, maxPerDoc: 20 },
  access: {
    read: publishedReadAccess,
    create: ({ req }) => hasRole(req.user, ['Admin', 'Editor', 'Author']),
    update: ({ req, data, doc }) => {
      if (hasRole(req.user, ['Admin', 'Editor'])) return true
      if (hasRole(req.user, ['Marketing'])) return true
      if (hasRole(req.user, ['Author'])) return isOwn({ req, doc })
      return false
    },
    delete: ({ req }) => hasRole(req.user, ['Admin', 'Editor']),
  },
  fields: [
    { name: 'title', type: 'text', required: true, index: true },
    {
      name: 'slug', type: 'text', required: true, unique: true,
      hooks: {
        beforeValidate: [({ value, data }) => {
          const base = (value || data?.title || '').toString()
          return base
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
        }],
      },
    },
    { name: 'author', type: 'relationship', relationTo: 'users', required: true },
    { name: 'coverImage', type: 'relationship', relationTo: 'media', required: true },
    { name: 'excerpt', type: 'textarea', required: true, index: true },
    {
      name: 'body',
      type: 'richText',
      admin: {
        elements: ['h2', 'h3', 'h4', 'blockquote', 'link', 'ul', 'ol', 'upload', 'relationship'],
      },
    },
    {
      name: 'tags',
      type: 'array',
      labels: { singular: 'Tag', plural: 'Tags' },
      maxRows: 10,
      fields: [{ name: 'value', type: 'text' }],
    },
    { name: 'canonicalUrl', type: 'text' },
    { name: 'ogImage', type: 'relationship', relationTo: 'media' },
    { name: 'readingMinutes', type: 'number' },
    { name: 'searchText', type: 'text', admin: { readOnly: true, condition: () => false }, index: true },
    SEOFields(),
    { name: 'publishedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'lastPublishEventAt', type: 'date', admin: { readOnly: true, condition: () => false } },
  ],
  hooks: {
    beforeChange: [({ data, originalDoc, req }) => {
      if (req?.user?.role === 'Author' && data?._status === 'published') {
        throw new Error('Authors cannot publish')
      }
      if (req?.user?.role === 'Author' && data?.publishedAt) {
        const now = new Date()
        const dt = new Date(data.publishedAt)
        if (dt < now) throw new Error('Authors cannot set publishedAt in the past')
      }
      // Prevent Marketing from changing slug/author
      if (hasRole(req.user, ['Marketing'])) {
        if (data?.slug && data.slug !== originalDoc?.slug) throw new Error('Marketing cannot change slug')
        if (data?.author && String(data.author) !== String(originalDoc?.author)) throw new Error('Marketing cannot change author')
        if (typeof data?._status !== 'undefined' && data._status !== originalDoc?._status) throw new Error('Marketing cannot change status')
        if (typeof data?.publishedAt !== 'undefined' && String(data.publishedAt) !== String(originalDoc?.publishedAt)) throw new Error('Marketing cannot change publishedAt')
      }
      // Auto reading minutes if not set
      if (!data.readingMinutes) {
        const text = `${data?.excerpt || ''} `
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length
        data.readingMinutes = Math.max(1, Math.round(wordCount / wordsPerMinute))
      }
      // Default ogImage to coverImage if empty
      if (!data.ogImage && data.coverImage) data.ogImage = data.coverImage
      // Build simple search index
      const bodyText = extractPlainText(data?.body)
      const fields = [data?.title, data?.excerpt, bodyText].filter(Boolean)
      ;(data as any).searchText = fields.join(' \n ').slice(0, 8000)
    }],
    beforeOperation: [({ operation, args, req }) => {
      if (operation !== 'read') return
      const q = (req?.query?.q as string) || ''
      if (!q) return
      const where = args?.where || { and: [] as any[] }
      const or = [
        { title: { like: q } },
        { excerpt: { like: q } },
        { searchText: { like: q } },
      ]
      if (!('and' in where)) (where as any).and = []
      ;(where as any).and.push({ or })
      args.where = where
    }],
    afterChange: [netlifyPublishHooks('posts', 'slug')],
  },
}

export default Posts
