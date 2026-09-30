/**
 * Money pages keep the exact JSON shape the keukenfaqs site already expects.
 * See keukenfaqs-main/src/content.config.ts: moneyPages uses a discriminated
 * union on `page_type` with three variants (top10, product, business). Each
 * variant must include every field — keys that don't apply are explicitly
 * `null` so the Zod schema validates.
 */

import type { FormattedFile } from './blog'

type ScrapeMeta = {
  fetched_at: string
  http_status: number
  content_hash: string
  html_bytes: number
}

const defaultScrape = (): ScrapeMeta => ({
  fetched_at: new Date().toISOString(),
  http_status: 200,
  content_hash: '',
  html_bytes: 0,
})

interface Top10Doc {
  id: string
  title: string
  slug: string
  h1?: string | null
  categorySingular?: string | null
  categoryPlural?: string | null
  intro?: string | null
  conclusion?: string | null
  metaDescription?: string | null
  ogDescription?: string | null
  publishedAt?: string | null
  lastUpdated?: string | null
  products?: Array<{
    rank: number
    name: string
    imageUrl?: string | null
    description?: string | null
    affiliateUrl?: string | null
    affiliateNetwork?: string | null
  }> | null
  faq?: Array<{ question: string; answerHtml: string }> | null
  scrape?: ScrapeMeta | null
  raw_html_sample?: string | null
}

interface ProductDoc {
  id: string
  name: string
  slug: string
  title?: string | null
  category?: string | null
  intro?: string | null
  description?: string | null
  rating?: number | null
  ratingOutOf?: number | null
  imageUrl?: string | null
  image?: { url?: string } | null
  affiliateUrl?: string | null
  affiliateNetwork?: string | null
  affiliateCta?: string | null
  specs?: Array<{ label: string; value: string }> | null
  pros?: Array<{ value: string }> | null
  cons?: Array<{ value: string }> | null
  metaDescription?: string | null
  ogDescription?: string | null
  publishedAt?: string | null
  lastUpdated?: string | null
  scrape?: ScrapeMeta | null
  raw_html_sample?: string | null
}

interface BusinessDoc {
  id: string
  name: string
  slug: string
  title?: string | null
  city?: string | null
  address?: string | null
  websiteUrl?: string | null
  googleMapsUrl?: string | null
  intro?: string | null
  metaDescription?: string | null
  ogDescription?: string | null
  publishedAt?: string | null
  lastUpdated?: string | null
  scrape?: ScrapeMeta | null
  raw_html_sample?: string | null
}

export function formatTop10Json(doc: Top10Doc, tenantDomain: string): FormattedFile {
  const payload = {
    url: `https://${tenantDomain}/${doc.slug}/`,
    slug: doc.slug,
    title: doc.title,
    h1: doc.h1 ?? undefined,
    page_type: 'top10' as const,
    meta_description: doc.metaDescription ?? null,
    og_description: doc.ogDescription ?? null,
    published_at: doc.publishedAt ?? null,
    last_updated: doc.lastUpdated ?? null,
    raw_html_sample: doc.raw_html_sample ?? '',
    scrape: doc.scrape ?? defaultScrape(),
    top10: {
      category_singular: doc.categorySingular ?? null,
      category_plural: doc.categoryPlural ?? null,
      intro: doc.intro ?? null,
      products: (doc.products ?? []).map((p) => ({
        rank: p.rank,
        name: p.name,
        image_url: p.imageUrl ?? null,
        description: p.description ?? null,
        affiliate_url: p.affiliateUrl ?? null,
        affiliate_network: p.affiliateNetwork ?? null,
      })),
      faq: (doc.faq ?? []).map((f) => ({
        question: f.question,
        answer_html: f.answerHtml,
      })),
      conclusion: doc.conclusion ?? null,
    },
    product: null,
    business: null,
  }
  return { filename: `${doc.slug}.json`, body: JSON.stringify(payload, null, 2) }
}

export function formatProductJson(doc: ProductDoc, tenantDomain: string): FormattedFile {
  const payload = {
    url: `https://${tenantDomain}/${doc.slug}/`,
    slug: doc.slug,
    title: doc.title ?? doc.name,
    h1: doc.title ?? doc.name,
    page_type: 'product' as const,
    meta_description: doc.metaDescription ?? null,
    og_description: doc.ogDescription ?? null,
    published_at: doc.publishedAt ?? null,
    last_updated: doc.lastUpdated ?? null,
    raw_html_sample: doc.raw_html_sample ?? '',
    scrape: doc.scrape ?? defaultScrape(),
    top10: null,
    product: {
      category: doc.category ?? null,
      name: doc.name,
      intro: doc.intro ?? null,
      rating: doc.rating ?? null,
      rating_out_of: doc.ratingOutOf ?? null,
      image_url: doc.imageUrl ?? doc.image?.url ?? null,
      affiliate_url: doc.affiliateUrl ?? null,
      affiliate_network: doc.affiliateNetwork ?? null,
      affiliate_cta: doc.affiliateCta ?? null,
      specs: (doc.specs ?? []).map((s) => ({ label: s.label, value: s.value })),
      description: doc.description ?? null,
      pros: (doc.pros ?? []).map((p) => p.value),
      cons: (doc.cons ?? []).map((c) => c.value),
    },
    business: null,
  }
  return { filename: `${doc.slug}.json`, body: JSON.stringify(payload, null, 2) }
}

export function formatBusinessJson(doc: BusinessDoc, tenantDomain: string): FormattedFile {
  const payload = {
    url: `https://${tenantDomain}/${doc.slug}/`,
    slug: doc.slug,
    title: doc.title ?? doc.name,
    h1: doc.title ?? doc.name,
    page_type: 'business' as const,
    meta_description: doc.metaDescription ?? null,
    og_description: doc.ogDescription ?? null,
    published_at: doc.publishedAt ?? null,
    last_updated: doc.lastUpdated ?? null,
    raw_html_sample: doc.raw_html_sample ?? '',
    scrape: doc.scrape ?? defaultScrape(),
    top10: null,
    product: null,
    business: {
      name: doc.name,
      city: doc.city ?? null,
      address: doc.address ?? null,
      website_url: doc.websiteUrl ?? null,
      google_maps_url: doc.googleMapsUrl ?? null,
      intro: doc.intro ?? null,
    },
  }
  return { filename: `${doc.slug}.json`, body: JSON.stringify(payload, null, 2) }
}
