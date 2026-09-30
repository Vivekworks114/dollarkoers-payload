'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

import { ciViewRunLabel, type CiProviderId } from '../lib/ci/ciBuildLinks'

type ApiResult = {
  ok: boolean
  message: string
  notes?: string[]
  runsUrl?: string | null
  runUrl?: string | null
  ciProvider?: CiProviderId
}

type Action = 'validate-github' | 'setup-github-repo' | 'import-blog-from-repo'

export function TenantGitHubConnect(): React.ReactElement {
  const { id } = useDocumentInfo()
  const [busy, setBusy] = useState<Action | null>(null)
  const [result, setResult] = useState<(ApiResult & { kind: Action }) | null>(null)

  const tenantId = typeof id === 'string' || typeof id === 'number' ? String(id) : null

  async function run(action: Action) {
    if (!tenantId) return
    setBusy(action)
    setResult(null)
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      })
      const body = (await res.json().catch(() => ({}))) as Partial<ApiResult>
      setResult({
        kind: action,
        ok: Boolean(body.ok),
        message:
          typeof body.message === 'string'
            ? body.message
            : res.ok
              ? 'Done.'
              : `Request failed: ${res.status}`,
        notes: body.notes,
        runsUrl: body.runsUrl ?? null,
        runUrl: body.runUrl ?? null,
        ciProvider: body.ciProvider,
      })
    } catch (err) {
      setResult({
        kind: action,
        ok: false,
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setBusy(null)
    }
  }

  const disabled = !tenantId

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150, #e5e7eb)',
        borderRadius: 6,
        padding: '16px 20px',
        margin: '0 0 24px',
        background: 'var(--theme-elevation-50, #f9fafb)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>GitHub repository</div>
      <div style={{ fontSize: 13, color: 'var(--theme-elevation-500, #6b7280)', marginBottom: 12 }}>
        {disabled
          ? 'Save the tenant first.'
          : 'Connect a client-owned Astro repo. Payload is the blog source of truth — publish syncs blog files at build time. Import reads .md and .mdx; set blog file extension (md/mdx) to match the site. On first publish, CI auto-imports into the CMS if empty.'}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => run('validate-github')}
        >
          {busy === 'validate-github' ? 'Validating…' : 'Validate repository'}
        </button>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => run('setup-github-repo')}
        >
          {busy === 'setup-github-repo' ? 'Starting…' : 'Setup repository (PR)'}
        </button>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => run('import-blog-from-repo')}
        >
          {busy === 'import-blog-from-repo' ? 'Importing…' : 'Import blog from repo (once)'}
        </button>
      </div>

      {result && (
        <div
          style={{
            fontSize: 13,
            padding: 12,
            borderRadius: 4,
            background: result.ok
              ? 'var(--theme-success-100, #ecfdf5)'
              : 'var(--theme-error-100, #fef2f2)',
          }}
        >
          <div style={{ fontWeight: 500 }}>{result.message}</div>
          {result.notes?.length ? (
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12 }}>{result.notes.join('\n')}</pre>
          ) : null}
          {result.runUrl ? (
            <a href={result.runUrl} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 8 }}>
              {ciViewRunLabel(result.ciProvider, result.runUrl)}
            </a>
          ) : null}
        </div>
      )}
    </div>
  )
}
