import type { Field } from 'payload'

/** SEO metadata fields shared across content collections. */
export const seoFields = (): Field => ({
  name: 'seo',
  type: 'group',
  admin: {
    description: 'Per-page SEO overrides. Falls back to the tenant defaults when blank.',
  },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'ogImage', type: 'upload', relationTo: 'media' },
    { name: 'robots', type: 'text', admin: { description: 'e.g. noindex,follow' } },
    {
      name: 'canonicalUrl',
      type: 'text',
      admin: { description: 'Override canonical URL if different from this site.' },
    },
  ],
})

/** Slug field with index for fast (tenant, slug) lookups. */
export const slugField = (description?: string): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  index: true,
  admin: { description: description ?? 'URL slug. Auto-normalized: lowercase, hyphens, no special characters.' },
})

/** Publish bar above the list table (manual publish — no auto-deploy on save). */
export const contentPublishComponents = {
  beforeListTable: ['/components/PublishContentBar.client#PublishContentBar'],
}

/**
 * In-document publish panel for edit/create views.
 * Use as the first field — do not use `edit.beforeDocumentControls` (that slot overlaps form fields).
 */
export const publishContentBarField = (): Field => ({
  name: 'publishLiveSite',
  type: 'ui',
  admin: {
    components: {
      Field: '/components/PublishContentBar.client#PublishContentBar',
    },
  },
})
