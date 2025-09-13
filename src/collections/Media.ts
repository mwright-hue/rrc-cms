import type { CollectionConfig } from 'payload/types'
import { hasRole } from '../access/roles'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_PDF_BYTES = 20 * 1024 * 1024 // 20 MB

const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Asset', plural: 'Media' },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'contentType', 'width', 'height'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => hasRole(req.user, ['Admin', 'Editor', 'Author', 'Marketing']),
    update: ({ req }) => hasRole(req.user, ['Admin', 'Editor', 'Author', 'Marketing']),
    delete: ({ req }) => hasRole(req.user, ['Admin', 'Editor']),
  },
  upload: {
    adminThumbnail: 'l320',
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'application/pdf',
    ],
    imageSizes: [
      { name: 'l320', width: 320, position: 'center' },
      { name: 'l640', width: 640, position: 'center' },
      { name: 'l1280', width: 1280, position: 'center' },
      { name: 'l1920', width: 1920, position: 'center' },
      { name: 'og', width: 1200, height: 630, position: 'center' },
      // WebP variants (Payload supports Sharp options via formatOptions)
      { name: 'l320_webp', width: 320, position: 'center', formatOptions: { format: 'webp' } as any },
      { name: 'l640_webp', width: 640, position: 'center', formatOptions: { format: 'webp' } as any },
      { name: 'l1280_webp', width: 1280, position: 'center', formatOptions: { format: 'webp' } as any },
      { name: 'l1920_webp', width: 1920, position: 'center', formatOptions: { format: 'webp' } as any },
      { name: 'og_webp', width: 1200, height: 630, position: 'center', formatOptions: { format: 'webp' } as any },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
    { name: 'caption', type: 'text' },
    // width, height, mimeType, filesize, and url are provided by Payload's upload system
  ],
  hooks: {
    beforeValidate: [async ({ data, req }) => {
      const file = (req as any)?.file || (data as any)?._file
      if (!file) return data
      const size = file.size as number
      const ct = file.mimetype as string
      if (ct === 'application/pdf' && size > MAX_PDF_BYTES) {
        throw new Error('PDF exceeds 20 MB limit')
      }
      if (ct.startsWith('image/') && size > MAX_IMAGE_BYTES) {
        throw new Error('Image exceeds 10 MB limit')
      }
      return data
    }],
  },
}

export default Media
