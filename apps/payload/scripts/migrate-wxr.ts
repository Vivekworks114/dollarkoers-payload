#!/usr/bin/env tsx
/**
 * Import a WordPress WXR export into Payload. Writes through Payload's Local
 * API (in-process, transactional, fast) instead of going through REST.
 *
 *   pnpm migrate:wxr -- --wxr ../sites/keukenfaqs/migration/wordpress-export.xml \
 *                       --slug keukenfaqs --domain keukenfaqs.nl
 *
 * What it does:
 *   1. Ensures a `tenants` row exists for --slug; creates one if not.
 *   2. Reads <item> entries from the WXR file.
 *   3. For each <item post_type="post">    -> creates a `blog-posts` row.
 *      (WordPress pages are skipped — static pages live in the Astro app.)
 *   5. Maps WP `<wp:status>publish</wp:status>` to upserted rows.
 *      Drafts and revisions are skipped.
 *
 * HTML body cleaning + turndown + heading-cascade logic mirror the original
 * apps/sites/keukenfaqs/migration/import-wxr.mjs script. Lexical content is
 * emitted as a single paragraph whose only child is a Markdown string —
 * Payload's Lexical editor treats unknown HTML as plain text, which matches
 * what `lexicalToMarkdown` (in @dollarkoers/payload-sdk) round-trips back to
 * Markdown at sync time.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { XMLParser } from 'fast-xml-parser'
import { getPayload } from 'payload'
import TurndownService from 'turndown'
// @ts-expect-error - no types
import { gfm } from 'turndown-plugin-gfm'

import config from '../src/payload.config'

/**
 * Resolve a CLI path argument relative to where the user actually invoked
 * the script. Prefers INIT_CWD (set by `npm run` / some pnpm versions), then
 * PWD (set by the shell before exec), and only falls back to process.cwd()
 * when neither is available. Without this, relative paths break because
 * pnpm chdirs into the package directory (apps/payload/) before running.
 */
function resolveUserPath(p: string): string {
  if (path.isAbsolute(p)) return p
  const base = process.env.INIT_CWD || process.env.PWD || process.cwd()
  return path.resolve(base, p)
}

interface Args {
  wxr: string
  slug: string
  domain: string
  limit?: number
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a?.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i++
    } else {
      out[key] = 'true'
    }
  }
  const wxr = out.wxr
  const slug = out.slug
  const domain = out.domain
  if (!wxr || !slug || !domain) {
    console.error('Usage: migrate-wxr --wxr <path> --slug <slug> --domain <domain> [--limit N]')
    process.exit(1)
  }
  return { wxr, slug, domain, limit: out.limit ? Number(out.limit) : undefined }
}

const SLUG_BLACKLIST = new Set([
  'de-plek-voor-alles-over-je-keuken',
  'zb_mp_title',
  'zb_mp_product-pannen',
  'zb_mp_product-keukenapparatuur',
  'top-10-beste',
  'best-geteste-zb_mp_product-2026',
  'tips',
  'category',
  'sitemap',
])

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  bulletListMarker: '-',
})
turndown.use(gfm)

const cdata = (node: unknown): string => {
  if (node == null) return ''
  if (Array.isArray(node)) return cdata(node[0])
  if (typeof node === 'string') return node
  if (typeof node === 'object') return ((node as { '#text'?: string })['#text']) ?? ''
  return String(node)
}
const arrayify = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])

function cleanHtml(html: string): string {
  if (!html) return ''
  let out = html
    .replace(/<!--\s*\/?wp:[^>]*-->/g, '')
    .replace(
      /\[\/?(?:caption|gallery|embed|video|audio|playlist|vc_\w+|et_pb_\w+|lmt-[\w-]+|fusion_\w+|su_\w+)(?:\s[^\]]*)?\]/gi,
      ''
    )
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/\sclass="[^"]*"/gi, '')

  if (/<h1\b/i.test(out)) {
    out = out.replace(
      /<(\/?)h([1-5])(\s[^>]*)?>/gi,
      (_, slash, n, attrs = '') => `<${slash}h${parseInt(n, 10) + 1}${attrs}>`
    )
  }
  return out
}

function deriveDescription(html: string): string {
  if (!html) return ''
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= 160) return text
  return text.slice(0, 157).trim() + '…'
}

/**
 * Wrap arbitrary Markdown text into a Lexical state document. The sync
 * pipeline's `lexicalToMarkdown` recognises this single-paragraph shape and
 * round-trips it back to Markdown unchanged.
 */
function markdownToLexicalState(markdown: string) {
  // Payload's Lexical "required" validator rejects a paragraph whose only
  // text node is empty. Fall back to a clearly-flagged placeholder so the
  // import doesn't blow up on stub pages; editors can fill them in later.
  const text = markdown.trim() || '[Imported from WordPress — original content was empty.]'
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          children: [{ type: 'text', format: 0, text, version: 1 }],
        },
      ],
      direction: 'ltr',
    },
  }
}

async function main(): Promise<void> {
  const args = parseArgs()
  console.log(`[migrate-wxr] wxr=${args.wxr} slug=${args.slug} domain=${args.domain}`)

  const payload = await getPayload({ config })

  // 1. Ensure tenant row. Look up by slug first, then by domain as a
  // fallback so a pre-existing tenant with a different-cased slug
  // (e.g. 'KeukenFAQs') is reused instead of colliding with the unique
  // `domain` constraint on create. Two separate queries are used because
  // Payload's `or:` operator can interact awkwardly with collection access
  // hooks; keep this dumb and reliable.
  let tenant = (
    await payload.find({
      collection: 'tenants',
      where: { slug: { equals: args.slug } },
      limit: 1,
    })
  ).docs[0]

  if (!tenant) {
    tenant = (
      await payload.find({
        collection: 'tenants',
        where: { domain: { equals: args.domain } },
        limit: 1,
      })
    ).docs[0]
    if (tenant) {
      const t = tenant as { slug?: string; domain?: string }
      console.log(
        `[migrate-wxr] reusing existing tenant matched by domain (slug='${t.slug}', domain='${t.domain}'). Pass --slug ${t.slug} next time to skip this lookup.`,
      )
    }
  }

  if (!tenant) {
    console.log(`[migrate-wxr] creating tenants row '${args.slug}'`)
    tenant = await payload.create({
      collection: 'tenants',
      data: {
        slug: args.slug,
        name: args.slug,
        domain: args.domain,
        locale: 'nl-NL',
        siteTitle: args.slug,
        siteDescription: `Imported tenant ${args.slug}. Update this in the admin.`,
      } as never,
    })
  }
  const tenantId = tenant.id as string | number

  // 2. Parse WXR.
  const xmlText = await fs.readFile(resolveUserPath(args.wxr), 'utf8')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    cdataPropName: '#text',
    trimValues: true,
  })
  const data = parser.parse(xmlText)
  const items = arrayify(data?.rss?.channel?.item) as Array<Record<string, unknown>>

  let posts = 0
  let skipped = 0

  for (const item of items) {
    const status = cdata(item['wp:status'])
    if (status !== 'publish') {
      skipped++
      continue
    }
    const postType = cdata(item['wp:post_type'])
    if (postType !== 'post') {
      skipped++
      continue
    }
    const slug = cdata(item['wp:post_name'])
    if (!slug || SLUG_BLACKLIST.has(slug)) {
      skipped++
      continue
    }

    const title = cdata(item.title)
    const rawHtml = cdata(item['content:encoded'])
    const html = cleanHtml(rawHtml)
    const markdown = turndown.turndown(html)
    const description = deriveDescription(rawHtml)
    const pubDateRaw = cdata(item['wp:post_date_gmt']) || cdata(item.pubDate)
    const pubDate = pubDateRaw ? new Date(pubDateRaw) : new Date()
    const modifiedRaw = cdata(item['wp:post_modified_gmt'])
    const updatedDate = modifiedRaw ? new Date(modifiedRaw) : undefined

    const categories = arrayify(item.category)
      .map((c) => cdata(c))
      .filter((s) => s && s !== 'Geen categorie')
      .map((value) => ({ value }))

    const existing = await payload.find({
      collection: 'blog-posts',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
      limit: 1,
    })
    const baseData = {
      tenant: tenantId,
      title,
      slug,
      description,
      pubDate: pubDate.toISOString(),
      updatedDate: updatedDate?.toISOString(),
      categories,
      content: markdownToLexicalState(markdown),
    } as never

    if (existing.docs[0]) {
      await payload.update({ collection: 'blog-posts', id: existing.docs[0].id, data: baseData })
    } else {
      await payload.create({ collection: 'blog-posts', data: baseData })
    }
    posts++

    if (args.limit && posts >= args.limit) {
      console.log('[migrate-wxr] reached --limit')
      break
    }
  }

  console.log(`[migrate-wxr] done. posts=${posts} skipped=${skipped} (WP pages not imported)`)
  process.exit(0)
}

main().catch((err) => {
  const inner = (err as { data?: { errors?: unknown } } | null)?.data?.errors
  if (inner) {
    console.error('[migrate-wxr] failed:', err)
    console.error('  validation details:', JSON.stringify(inner, null, 2))
  } else {
    console.error('[migrate-wxr] failed:', err)
  }
  process.exit(1)
})
