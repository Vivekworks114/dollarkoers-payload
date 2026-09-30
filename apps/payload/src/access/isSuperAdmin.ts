/**
 * Accept any user-like value. Payload threads users as `UntypedUser` until
 * `pnpm payload generate:types` has been run, at which point they become the
 * real `User`. We only ever care about the `roles[]` field so we narrow
 * structurally.
 */
export const isSuperAdmin = (user: unknown): boolean => {
  if (!user || typeof user !== 'object') return false
  const roles = (user as { roles?: unknown }).roles
  return Array.isArray(roles) && roles.includes('super-admin')
}
