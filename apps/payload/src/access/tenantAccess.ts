import type { Access } from 'payload'

import { isCiServiceAuthorized } from './ciServiceAuth'
import { isSuperAdmin } from './isSuperAdmin'

/**
 * Authenticated users can read. The multi-tenant plugin layers an additional
 * `where: { tenant: { in: user.tenants } }` filter on top, so a regular
 * editor will still only see their tenants' rows.
 */
export const authenticatedRead: Access = ({ req }) => Boolean(req.user)

export const superAdminOnly: Access = ({ req }) => isSuperAdmin(req.user)

/**
 * REST read for CMS data consumed by builds and CI:
 * - Admin session or `Authorization: users API-Key …` (PAYLOAD_API_KEY)
 * - `x-deploy-report-token` matching DEPLOY_REPORT_TOKEN (platform CI)
 */
export const cmsApiRead: Access = ({ req }) => {
  if (req.user) return true
  return isCiServiceAuthorized(req)
}

/** @deprecated Use cmsApiRead — kept for reference only. */
export const publicRead: Access = () => true
