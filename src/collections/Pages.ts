import type { CollectionConfig } from 'payload/types'
import { hasRole, publishedReadAccess } from '../access/roles'
import { SEOFields } from '../fields/SEOFields'
import { netlifyPublishHooks } from '../hooks/webhookEvents'

const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'publishedAt', '_status'],
  },
  versions: { drafts: true, maxPerDoc: 20 },
  defaultSort: '-publishedAt',
  access: {
    read: publishedReadAccess,
    create: ({ req }) => hasRole(req.user, ['Admin', 'Editor', 'Author']),
    update: ({ req, data }) => {
      if (hasRole(req.user, ['Admin', 'Editor'])) return true
      if (hasRole(req.user, ['Marketing'])) return true
      if (hasRole(req.user, ['Author'])) {
        return { _status: { equals: 'draft' } }
      }
      return false
    },
    delete: ({ req }) => hasRole(req.user, ['Admin', 'Editor']),
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Lowercase, hyphenated; auto-generated from title.' },
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
    { name: 'heroImage', type: 'relationship', relationTo: 'media' },
    { name: 'intro', type: 'textarea' },
    {
      name: 'blocks',
      type: 'blocks',
      required: false,
      blocks: [
        {
          slug: 'hero',
          labels: { singular: 'Hero', plural: 'Heros' },
          fields: [
            { name: 'heading', type: 'text', required: true },
            { name: 'subheading', type: 'text' },
            { name: 'media', type: 'relationship', relationTo: 'media' },
            {
              name: 'cta',
              type: 'group',
              fields: [
                { name: 'label', type: 'text' },
                { name: 'url', type: 'text' },
              ],
            },
          ],
        },
        {
          slug: 'featureGrid',
          labels: { singular: 'Feature Grid', plural: 'Feature Grids' },
          fields: [
            {
              name: 'items',
              type: 'array',
              labels: { singular: 'Feature', plural: 'Features' },
              fields: [
                { name: 'icon', type: 'relationship', relationTo: 'media' },
                { name: 'title', type: 'text', required: true },
                { name: 'body', type: 'textarea' },
              ],
            },
          ],
        },
        {
          slug: 'splitContent',
          labels: { singular: 'Split Content', plural: 'Split Content' },
          fields: [
            { name: 'image', type: 'relationship', relationTo: 'media' },
            { name: 'imagePosition', type: 'select', options: [
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ], defaultValue: 'left' },
            { name: 'heading', type: 'text' },
            { name: 'richText', type: 'richText' },
          ],
        },
        {
          slug: 'caseStudyTeaser',
          labels: { singular: 'Case Study Teaser', plural: 'Case Study Teasers' },
          fields: [
            { name: 'items', type: 'relationship', relationTo: 'case-studies', hasMany: true, maxRows: 6 },
          ],
        },
        {
          slug: 'cta',
          labels: { singular: 'CTA', plural: 'CTAs' },
          fields: [
            { name: 'heading', type: 'text' },
            { name: 'body', type: 'textarea' },
            {
              name: 'button',
              type: 'group',
              fields: [
                { name: 'label', type: 'text' },
                { name: 'url', type: 'text' },
              ],
            },
          ],
        },
      ],
    },
    SEOFields(),
    { name: 'search', type: 'text', admin: { readOnly: true, condition: () => false }, index: true },
    { name: 'publishedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
  ],
  hooks: {
    beforeChange: [({ req, data, originalDoc }) => {
      if (req?.user?.role === 'Author' && data?._status === 'published') {
        throw new Error('Authors cannot publish')
      }
      if (req?.user?.role === 'Author' && data?.publishedAt) {
        const now = new Date()
        const dt = new Date(data.publishedAt)
        if (dt < now) throw new Error('Authors cannot set publishedAt in the past')
      }
      // Prevent Marketing from changing slug
      if (hasRole(req.user, ['Marketing']) && data?.slug !== originalDoc?.slug) {
        throw new Error('Marketing cannot change slugs')
      }
      if (hasRole(req.user, ['Marketing'])) {
        if (typeof data?._status !== 'undefined' && data._status !== originalDoc?._status) throw new Error('Marketing cannot change status')
        if (typeof data?.publishedAt !== 'undefined' && String(data.publishedAt) !== String(originalDoc?.publishedAt)) throw new Error('Marketing cannot change publishedAt')
      }
      // Build simple search index from title + intro only (blocks omitted)
      const fields = [data?.title, data?.intro].filter(Boolean)
      ;(data as any).search = (fields.join(' \n ').slice(0, 8000))
    }],
    afterChange: [netlifyPublishHooks('pages', 'slug')],
  },
}

export default Pages
