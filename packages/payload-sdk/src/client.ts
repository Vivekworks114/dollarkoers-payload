/**
 * Thin typed REST client for Payload. All requests carry the API key as a
 * Bearer token and the tenant slug as a `where[tenant.slug][equals]=...`
 * filter so a build for tenant X only ever sees X's data.
 */

import { buildWhereSearchParams, mergeSearchParams } from './buildWhereParams'

export interface PayloadClientOptions {
  url: string                  // Payload server URL, e.g. https://cms.example.com
  apiKey?: string              // Bearer token (users API-Key / PAYLOAD_API_KEY)
  /** CI service token — alternative to apiKey when DEPLOY_REPORT_TOKEN is set on CMS. */
  deployReportToken?: string
  tenantSlug: string
  /** Throw if any request takes longer than this many ms. Default 30s. */
  timeoutMs?: number
}

export interface PayloadFindResult<T> {
  docs: T[]
  totalDocs: number
  page: number
  totalPages: number
  hasNextPage: boolean
  limit: number
}

export interface PayloadFindArgs {
  limit?: number
  page?: number
  sort?: string
  depth?: number
  where?: Record<string, unknown>
}

export class PayloadClient {
  private readonly url: string
  private readonly apiKey?: string
  private readonly deployReportToken?: string
  private readonly tenantSlug: string
  private readonly timeoutMs: number
  private tenantId: string | null = null

  constructor(opts: PayloadClientOptions) {
    this.url = opts.url.replace(/\/+$/, '')
    this.apiKey = opts.apiKey
    this.deployReportToken = opts.deployReportToken
    this.tenantSlug = opts.tenantSlug
    this.timeoutMs = opts.timeoutMs ?? 30_000
  }

  /** Resolve and cache the tenant's numeric/UUID id; needed for nested filters. */
  async resolveTenantId(): Promise<string> {
    if (this.tenantId) return this.tenantId
    const res = await this.request<PayloadFindResult<{ id: string }>>(
      'GET',
      `/api/tenants?where[slug][equals]=${encodeURIComponent(this.tenantSlug)}&limit=1`
    )
    const id = res.docs[0]?.id
    if (!id) {
      throw new Error(`[payload-sdk] tenant '${this.tenantSlug}' not found in Payload`)
    }
    this.tenantId = id
    return id
  }

  async findTenant<T = unknown>(): Promise<T> {
    const res = await this.request<PayloadFindResult<T>>(
      'GET',
      `/api/tenants?where[slug][equals]=${encodeURIComponent(this.tenantSlug)}&limit=1&depth=2`
    )
    const tenant = res.docs[0]
    if (!tenant) {
      throw new Error(`[payload-sdk] tenant '${this.tenantSlug}' not found in Payload`)
    }
    return tenant
  }

  /**
   * Find all docs in a tenant-scoped collection, transparently paginating.
   * Yields rows in batches of `limit` (default 100).
   */
  async findAll<T>(collection: string, args: PayloadFindArgs = {}): Promise<T[]> {
    const tenantId = await this.resolveTenantId()
    const limit = args.limit ?? 100
    const depth = args.depth ?? 2
    const sort = args.sort ?? '-updatedAt'

    const baseWhere: Record<string, unknown> = {
      ...(args.where ?? {}),
      tenant: { equals: tenantId },
    }

    const all: T[] = []
    let page = 1
    let totalPages = 1

    do {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('page', String(page))
      params.set('depth', String(depth))
      params.set('sort', sort)
      mergeSearchParams(params, buildWhereSearchParams(baseWhere))

      const res = await this.request<PayloadFindResult<T>>(
        'GET',
        `/api/${collection}?${params.toString()}`
      )
      all.push(...res.docs)
      totalPages = res.totalPages
      page += 1
    } while (page <= totalPages)

    return all
  }

  /** Total documents for this tenant in a collection (uses `totalDocs` from a minimal page). */
  async count(collection: string, extraWhere?: Record<string, unknown>): Promise<number> {
    const tenantId = await this.resolveTenantId()
    const params = new URLSearchParams()
    params.set('limit', '1')
    params.set('depth', '0')
    const baseWhere: Record<string, unknown> = {
      ...(extraWhere ?? {}),
      tenant: { equals: tenantId },
    }
    mergeSearchParams(params, buildWhereSearchParams(baseWhere))
    const res = await this.request<PayloadFindResult<unknown>>(
      'GET',
      `/api/${collection}?${params.toString()}`,
    )
    return res.totalDocs
  }

  async findOne<T>(
    collection: string,
    where: Record<string, unknown>,
    depth = 0,
  ): Promise<T | null> {
    const tenantId = await this.resolveTenantId()
    const params = new URLSearchParams()
    params.set('limit', '1')
    params.set('depth', String(depth))
    const baseWhere: Record<string, unknown> = {
      ...where,
      tenant: { equals: tenantId },
    }
    mergeSearchParams(params, buildWhereSearchParams(baseWhere))
    const res = await this.request<PayloadFindResult<T>>(
      'GET',
      `/api/${collection}?${params.toString()}`,
    )
    return res.docs[0] ?? null
  }

  async create<T>(collection: string, data: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', `/api/${collection}`, data)
  }

  async update<T>(collection: string, id: string, data: Record<string, unknown>): Promise<T> {
    return this.request<T>('PATCH', `/api/${collection}/${encodeURIComponent(id)}`, data)
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.apiKey) {
      headers.Authorization = `users API-Key ${this.apiKey}`
    }
    if (this.deployReportToken) {
      headers['x-deploy-report-token'] = this.deployReportToken
    }
    return headers
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(`${this.url}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...this.authHeaders(),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const authHint =
          res.status === 401 || res.status === 403
            ? ' Set PAYLOAD_API_KEY (super-admin Users → Enable API Key) or DEPLOY_REPORT_TOKEN matching the CMS server.'
            : ''
        throw new Error(
          `[payload-sdk] ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}${authHint}`,
        )
      }
      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }
}
