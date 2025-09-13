import type { CollectionConfig } from 'payload/types'
import { hasRole, publishedReadAccess } from '../access/roles'
import { SEOFields } from '../fields/SEOFields'
import { netlifyPublishHooks } from '../hooks/webhookEvents'
import { extractPlainText } from '../utils/richText'

const CaseStudies: CollectionConfig = {
  slug: 'case-studies',
  labels: { singular: 'Case Study', plural: 'Case Studies' },
  admin: {
    useAsTitle: 'clientName',
    defaultColumns: ['clientName', 'industry', 'publishedAt', '_status'],
    defaultSort: 'clientName',
  },
  versions: { drafts: true, maxPerDoc: 20 },
  access: {
    read: publishedReadAccess,
    create: ({ req }) => hasRole(req.user, ['Admin', 'Editor', 'Marketing']),
    update: ({ req }) => hasRole(req.user, ['Admin', 'Editor', 'Marketing']),
    delete: ({ req }) => hasRole(req.user, ['Admin', 'Editor']),
  },
  fields: [
    { name: 'clientName', type: 'text', required: true, index: true },
    { name: 'industry', type: 'text' },
    {
      name: 'services',
      type: 'array',
      labels: { singular: 'Service', plural: 'Services' },
      fields: [{ name: 'value', type: 'text' }],
    },
    { name: 'heroImage', type: 'relationship', relationTo: 'media', required: true },
    { name: 'summary', type: 'textarea', required: true, index: true },
    { name: 'challenge', type: 'richText' },
    { name: 'approach', type: 'richText' },
    { name: 'outcome', type: 'richText' },
    { name: 'searchText', type: 'text', admin: { readOnly: true, condition: () => false }, index: true },
    {
      name: 'metrics',
      type: 'array',
      labels: { singular: 'Metric', plural: 'Metrics' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'value', type: 'text', required: true },
      ],
    },
    {
      name: 'gallery',
      type: 'array',
      labels: { singular: 'Image', plural: 'Gallery' },
      fields: [
        { name: 'image', type: 'relationship', relationTo: 'media', required: true },
      ],
    },
    {
      name: 'testimonial',
      type: 'group',
      fields: [
        { name: 'quote', type: 'textarea' },
        { name: 'attribution', type: 'text' },
        { name: 'roleCompany', type: 'text' },
        { name: 'avatar', type: 'relationship', relationTo: 'media' },
      ],
    },
    { name: 'ctaLabel', type: 'text' },
    { name: 'ctaUrl', type: 'text' },
    SEOFields(),
    { name: 'publishedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'lastPublishEventAt', type: 'date', admin: { readOnly: true, condition: () => false } },
  ],
  hooks: {
    beforeChange: [({ req, data, originalDoc }) => {
      if (hasRole(req.user, ['Marketing'])) {
        if (typeof data?._status !== 'undefined' && data._status !== originalDoc?._status) throw new Error('Marketing cannot change status')
        if (typeof data?.publishedAt !== 'undefined' && String(data.publishedAt) !== String(originalDoc?.publishedAt)) throw new Error('Marketing cannot change publishedAt')
      }
      // Build search text from rich fields
      const challenge = extractPlainText(data?.challenge)
      const approach = extractPlainText(data?.approach)
      const outcome = extractPlainText(data?.outcome)
      ;(data as any).searchText = [data?.clientName, data?.summary, challenge, approach, outcome]
        .filter(Boolean)
        .join(' \n ')
        .slice(0, 8000)
    }],
    afterChange: [netlifyPublishHooks('case-studies', 'clientName')],
    beforeOperation: [({ operation, args, req }) => {
      if (operation !== 'read') return
      const q = (req?.query?.q as string) || ''
      if (!q) return
      const where = args?.where || { and: [] as any[] }
      const or = [
        { clientName: { like: q } },
        { summary: { like: q } },
        { searchText: { like: q } },
      ]
      if (!('and' in where)) (where as any).and = []
      ;(where as any).and.push({ or })
      args.where = where
    }],
  },
}

export default CaseStudies
