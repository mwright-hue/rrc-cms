import type { GlobalConfig } from 'payload/types'

const SEODefaults: GlobalConfig = {
  slug: 'seo-defaults',
  label: 'SEO Defaults',
  access: {
    read: () => true,
    update: ({ req }) => ['Admin', 'Editor'].includes(req?.user?.role),
  },
  fields: [
    { name: 'defaultMetaTitle', type: 'text', admin: { description: 'Suggested max ~60 characters' } },
    { name: 'defaultMetaDescription', type: 'textarea', admin: { description: 'Suggested max ~160 characters' } },
    { name: 'defaultOgImage', type: 'relationship', relationTo: 'media', required: true },
    { name: 'robotsIndex', type: 'checkbox', defaultValue: true },
    { name: 'sitemapEnabled', type: 'checkbox', defaultValue: true },
    { name: 'canonicalBase', type: 'text' },
  ],
}

export default SEODefaults

