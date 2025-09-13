import type { Field } from 'payload/types'

export const SEOFields = (overrides?: { requireOg?: boolean }): Field => ({
  name: 'seo',
  type: 'group',
  label: 'SEO',
  fields: [
    {
      name: 'metaTitle',
      type: 'text',
      admin: { description: 'Suggested max ~60 characters' },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      admin: { description: 'Suggested max ~160 characters' },
    },
    {
      name: 'ogImage',
      type: 'relationship',
      relationTo: 'media',
      required: Boolean(overrides?.requireOg),
    },
    { name: 'canonicalUrl', type: 'text' },
  ],
})

