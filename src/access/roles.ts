export type Role = 'Admin' | 'Editor' | 'Author' | 'Marketing'

export const hasRole = (user: any, roles: Role[]): boolean => {
  if (!user) return false
  return roles.includes(user.role)
}

export const isAdmin = (user: any) => hasRole(user, ['Admin'])
export const isEditor = (user: any) => hasRole(user, ['Admin', 'Editor'])
export const isAuthor = (user: any) => hasRole(user, ['Admin', 'Editor', 'Author'])
export const isMarketing = (user: any) => hasRole(user, ['Admin', 'Editor', 'Marketing'])

export const canManageContent = (user: any) => hasRole(user, ['Admin', 'Editor'])

// Generic ownership check helper
export const isOwn = ({ req, doc }: { req: any; doc: any }) => {
  try {
    return Boolean(req?.user && doc?.author && String(doc.author) === String(req.user.id))
  } catch (_) {
    return false
  }
}

// Public read guard for published at/after
export const publishedReadAccess = ({ req }: { req: any }) => {
  // Authenticated roles can read everything in admin
  if (req?.user) return true
  const now = new Date().toISOString()
  return {
    and: [
      { _status: { equals: 'published' } },
      { publishedAt: { less_than_equal: now } },
    ],
  }
}

