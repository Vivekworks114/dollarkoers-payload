'use client'

import { useAuth } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'

import { ciTrackBuildLabel, type CiProviderId } from '../lib/ci/ciBuildLinks'
import { DeployTargetBadge } from './DeployTargetBadge.client'
import {
  publishPanelCard,
  publishPrimaryButton,
  publishResultBox,
} from './publishPanelStyles'
import { useTenantDeployTarget } from './useTenantDeployTarget'

const TENANT_COOKIE = 'payload-tenant'

type PublishResult = {
  ok: boolean
  message: string
  runUrl?: string | null
  ciProvider?: CiProviderId
}

function readTenantIdFromCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${TENANT_COOKIE}=([^;]+)`))
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

/**
 * Shown above document controls on content list/edit views.
 */
export function PublishContentBar(): React.ReactElement | null {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string | undefined>()
  const [tenantLabel, setTenantLabel] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)

  const { target, loading, refresh } = useTenantDeployTarget(tenantId)

  const refreshTenant = useCallback(() => {
    const id = readTenantIdFromCookie()
    setTenantId(id)
    if (!id) {
      setTenantLabel(undefined)
      return
    }
    void fetch(`/api/tenants/${encodeURIComponent(id)}?depth=0`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc: { name?: string; slug?: string } | null) => {
        if (doc?.name) setTenantLabel(doc.name)
        else if (doc?.slug) setTenantLabel(doc.slug)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    refreshTenant()
    const interval = window.setInterval(refreshTenant, 2000)
    return () => window.clearInterval(interval)
  }, [refreshTenant])

  if (!user) return null

  const canPublish = Boolean(tenantId) && !busy

  async function publish() {
    if (!tenantId) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      })
      const body = (await res.json().catch(() => ({}))) as Partial<PublishResult>
      setResult({
        ok: Boolean(body.ok),
        message:
          typeof body.message === 'string'
            ? body.message
            : res.ok
              ? 'The live site updates when CI finishes (~2 minutes).'
              : `Publish failed: ${res.status} ${res.statusText}`,
        runUrl: body.runUrl ?? null,
        ciProvider: body.ciProvider,
      })
      if (body.ok) refresh()
    } catch (err) {
      setResult({
        ok: false,
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={publishPanelCard}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.3,
              color: 'var(--theme-text, #111827)',
            }}
          >
            Live site
          </h3>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 13,
              lineHeight: 1.45,
              color: 'var(--theme-elevation-500, #6b7280)',
            }}
          >
            {tenantId
              ? `Saving updates the CMS only. Publish when ready${tenantLabel ? ` (${tenantLabel})` : ''}. Posts set to Scheduled go live automatically when their pub date is reached (checked hourly).`
              : 'Select a site in the tenant switcher above, then publish your saved changes.'}
          </p>
        </div>

        <button
          type="button"
          disabled={!canPublish}
          onClick={() => void publish()}
          style={publishPrimaryButton(!canPublish)}
        >
          {busy ? 'Publishing…' : 'Publish content to live site'}
        </button>
      </div>

      {tenantId && !loading && target ? (
        <div style={{ marginTop: 14 }}>
          <DeployTargetBadge mode={target.mode} label={target.label} />
        </div>
      ) : null}

      {result ? (
        <div style={publishResultBox(result.ok)} role="status">
          <div style={{ fontWeight: 600, marginBottom: result.message ? 4 : 0 }}>
            {result.ok ? 'Publish started' : 'Publish failed'}
          </div>
          <div>{result.message}</div>
          {result.runUrl ? (
            <div style={{ marginTop: 8 }}>
              <a href={result.runUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 500 }}>
                {ciTrackBuildLabel(result.ciProvider, result.runUrl)}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default PublishContentBar