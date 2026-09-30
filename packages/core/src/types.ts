/**
 * The shape of `tenant.config.json` — written by `payload-sdk` at sync time,
 * read by each tenant Astro app at build time.
 *
 * Kept in sync with the `Tenants` Payload collection, but de-coupled so the
 * Astro side never imports from Payload.
 */

export interface ThemeTokens {
  primary?: string
  primaryDark?: string
  accent?: string
  background?: string
  text?: string
  muted?: string
  fontHeading?: string
  fontBody?: string
  radius?: string
}

export interface SocialLink {
  platform: 'facebook' | 'instagram' | 'twitter' | 'youtube' | 'tiktok' | 'pinterest' | 'linkedin'
  url: string
}

export interface NavItem {
  label: string
  href: string
  rel?: string
  children?: NavItem[]
}

export interface NavMenu {
  location: 'header' | 'footer' | 'mobile'
  name: string
  items: NavItem[]
}

export interface TenantConfig {
  // Identity
  id: string
  slug: string
  name: string
  domain: string
  url: string                // https://<domain>
  locale: string

  // Branding
  logo?: string | null       // R2 URL
  favicon?: string | null
  ogImage?: string | null
  themeTokens: ThemeTokens

  // SEO
  siteTitle: string
  siteDescription: string
  titleSuffix?: string | null
  robots?: string | null

  // Analytics
  ga4Id?: string | null
  gtmId?: string | null
  plausibleDomain?: string | null

  // Affiliate
  bolPublisherId?: string | null
  awinId?: string | null
  amazonTag?: string | null

  // Social
  socialLinks: SocialLink[]

  // Nav
  navMenus: NavMenu[]

  // Sync metadata
  syncedAt: string
}
