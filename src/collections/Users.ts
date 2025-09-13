import type { CollectionConfig } from 'payload/types'
import { isAdmin } from '../access/roles'

const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'User', plural: 'Users' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['firstName', 'lastName', 'email', 'role'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  auth: {
    verify: false,
    maxLoginAttempts: 10,
    tokenExpiration: 7200,
  },
  hooks: {
    beforeValidate: [({ req }) => {
      const pwd = (req as any)?.body?.password
      if (pwd) {
        const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{12,}$/.test(pwd)
        if (!strong) {
          throw new Error('Password must be 12+ characters and include upper, lower, number, and symbol')
        }
      }
    }],
  },
  fields: [
    { name: 'firstName', type: 'text', required: true },
    { name: 'lastName', type: 'text', required: true },
    { name: 'avatar', type: 'relationship', relationTo: 'media', required: false },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Admin', value: 'Admin' },
        { label: 'Editor', value: 'Editor' },
        { label: 'Author', value: 'Author' },
        { label: 'Marketing', value: 'Marketing' },
      ],
      defaultValue: 'Author',
      admin: { description: 'Controls access to content & settings.' },
    },
  ],
}

export default Users
