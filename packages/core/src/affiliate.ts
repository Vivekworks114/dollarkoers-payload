import type { TenantConfig } from './types'

/**
 * Wrap a bare product URL in the configured Bol.com partner click tracker.
 * Returns the input unchanged if no publisher ID is configured.
 */
export function wrapBolAffiliateUrl(productUrl: string, tenant: TenantConfig): string {
  if (!tenant.bolPublisherId) return productUrl
  return `https://partner.bol.com/click/click?p=2&t=url&s=${tenant.bolPublisherId}&f=TXL&url=${encodeURIComponent(productUrl)}`
}
