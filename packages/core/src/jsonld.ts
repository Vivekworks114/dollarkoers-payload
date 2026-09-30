import type { TenantConfig } from './types'

export function organizationJsonLd(tenant: TenantConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${tenant.url}/#organization`,
    name: tenant.name,
    url: tenant.url,
    logo: tenant.logo ?? `${tenant.url}/og-default.png`,
    sameAs: tenant.socialLinks.map((l) => l.url),
  }
}

export function websiteJsonLd(tenant: TenantConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${tenant.url}/#website`,
    name: tenant.name,
    url: tenant.url,
    description: tenant.siteDescription,
    inLanguage: tenant.locale.replace('_', '-'),
    publisher: { '@id': `${tenant.url}/#organization` },
  }
}
