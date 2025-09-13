import type { GlobalConfig } from 'payload/types'

const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  access: {
    read: () => true,
    update: ({ req }) => ['Admin', 'Editor'].includes(req?.user?.role),
  },
  fields: [
    { name: 'siteName', type: 'text', required: true },
    { name: 'logo', type: 'relationship', relationTo: 'media', required: true },
    {
      name: 'primaryNav',
      type: 'array',
      labels: { singular: 'Nav Item', plural: 'Primary Nav' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'footerNav',
      type: 'array',
      labels: { singular: 'Nav Item', plural: 'Footer Nav' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'socialLinks',
      type: 'group',
      fields: [
        { name: 'instagram', type: 'text' },
        { name: 'facebook', type: 'text' },
        { name: 'linkedin', type: 'text' },
        { name: 'xTwitter', label: 'X / Twitter', type: 'text' },
      ],
    },
    { name: 'contactEmail', type: 'email' },
    { name: 'contactPhone', type: 'text' },
    { name: 'address', type: 'textarea' },
    { name: 'analyticsId', type: 'text' },
  ],
}

export default SiteSettings

