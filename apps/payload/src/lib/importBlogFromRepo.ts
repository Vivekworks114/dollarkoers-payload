import fs from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'

import {
  blogPostDataFromFile,
  countBlogContentFilenames,
  listBlogContentFilenames,
  slugFromBlogFilename,
} from './blogContentFiles'

export interface ImportBlogFromRepoOptions {
  tenantSlug: string
  siteRoot: string
  blogPath?: string
  limit?: number
}

export interface ImportBlogFromRepoResult {
  created: number
  updated: number
  fileCount: number
  blogDir: string
}

export function resolveSitePath(siteRoot: string): string {
  if (path.isAbsolute(siteRoot)) return siteRoot
  const base = process.env.INIT_CWD || process.env.PWD || process.cwd()
  return path.resolve(base, siteRoot)
}

export interface BlogPostFilePayload {
  filename: string
  content: string
}

/** Read .md / .mdx files from a site repo for CI import. */
export async function readBlogPostsFromSite(
  options: Pick<ImportBlogFromRepoOptions, 'siteRoot' | 'blogPath' | 'limit'>,
): Promise<{ blogDir: string; posts: BlogPostFilePayload[] }> {
  const blogPath = options.blogPath?.replace(/^\/+/, '') || 'src/content/blog'
  const blogDir = path.join(resolveSitePath(options.siteRoot), blogPath)

  let entries: string[]
  try {
    entries = await fs.readdir(blogDir)
  } catch {
    throw new Error(`Blog directory not found: ${blogDir}`)
  }

  const files = listBlogContentFilenames(entries, options.limit)
  const posts: BlogPostFilePayload[] = []
  for (const file of files) {
    const content = await fs.readFile(path.join(blogDir, file), 'utf8')
    posts.push({ filename: file, content })
  }
  return { blogDir, posts }
}

export async function countTenantBlogPosts(
  payload: Payload,
  tenantId: string | number,
): Promise<number> {
  const result = await payload.find({
    collection: 'blog-posts',
    where: { tenant: { equals: tenantId } },
    limit: 1,
  })
  return result.totalDocs
}

export async function importBlogFromRepo(
  payload: Payload,
  options: ImportBlogFromRepoOptions,
): Promise<ImportBlogFromRepoResult> {
  const blogPath = options.blogPath?.replace(/^\/+/, '') || 'src/content/blog'
  const blogDir = path.join(resolveSitePath(options.siteRoot), blogPath)

  const tenant = (
    await payload.find({
      collection: 'tenants',
      where: { slug: { equals: options.tenantSlug } },
      limit: 1,
    })
  ).docs[0]
  if (!tenant) {
    throw new Error(`Tenant "${options.tenantSlug}" not found.`)
  }
  const tenantId = tenant.id

  let entries: string[]
  try {
    entries = await fs.readdir(blogDir)
  } catch {
    throw new Error(`Blog directory not found: ${blogDir}`)
  }

  const files = listBlogContentFilenames(entries, options.limit)
  let created = 0
  let updated = 0

  for (const file of files) {
    const slug = slugFromBlogFilename(file)!
    const raw = await fs.readFile(path.join(blogDir, file), 'utf8')
    const baseData = blogPostDataFromFile(raw, slug, tenantId) as never

    const existing = await payload.find({
      collection: 'blog-posts',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
      limit: 1,
    })

    if (existing.docs[0]) {
      await payload.update({ collection: 'blog-posts', id: existing.docs[0].id, data: baseData })
      updated++
    } else {
      await payload.create({ collection: 'blog-posts', data: baseData })
      created++
    }
  }

  if (created > 0 || updated > 0) {
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: { blogImportedFromRepoAt: new Date().toISOString() } as never,
      overrideAccess: true,
    })
  }

  return { created, updated, fileCount: files.length, blogDir }
}

export async function autoImportBlogIfEmpty(
  payload: Payload,
  options: ImportBlogFromRepoOptions,
): Promise<{ skipped: boolean; reason?: string; result?: ImportBlogFromRepoResult }> {
  const tenant = (
    await payload.find({
      collection: 'tenants',
      where: { slug: { equals: options.tenantSlug } },
      limit: 1,
    })
  ).docs[0]
  if (!tenant) {
    throw new Error(`Tenant "${options.tenantSlug}" not found.`)
  }

  const existing = await countTenantBlogPosts(payload, tenant.id)
  if (existing > 0) {
    return { skipped: true, reason: `${existing} post(s) already in Payload` }
  }

  const blogPath = options.blogPath?.replace(/^\/+/, '') || 'src/content/blog'
  const blogDir = path.join(resolveSitePath(options.siteRoot), blogPath)
  let entries: string[]
  try {
    entries = await fs.readdir(blogDir)
  } catch {
    return { skipped: true, reason: `no blog folder at ${blogDir}` }
  }

  const fileCount = countBlogContentFilenames(entries)
  if (fileCount === 0) {
    return { skipped: true, reason: `no .md or .mdx files in ${blogDir}` }
  }

  const result = await importBlogFromRepo(payload, options)
  return { skipped: false, result }
}
