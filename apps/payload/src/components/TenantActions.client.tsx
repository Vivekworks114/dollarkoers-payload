'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

import { ciTrackBuildLabel, ciViewRunsLabel, type CiProviderId } from '../lib/ci/ciBuildLinks'
import { DeployTargetBadge } from './DeployTargetBadge.client'
import { publishResultBox } from './publishPanelStyles'
import { useTenantDeployTarget } from './useTenantDeployTarget'

type ApiResult = {
  ok: boolean
  message: string
  runsUrl?: string | null
  runUrl?: string | null
  ciProvider?: CiProviderId
  deployMode?: 'monorepo' | 'external'
  deployTarget?: string
}

type Action = 'scaffold' | 'deploy' | 'publish'

export function TenantActions(): React.ReactElement {
  const { id } = useDocumentInfo()
  const [busy, setBusy] = useState<Action | null>(null)
  const [result, setResult] = useState<(ApiResult & { kind: Action }) | null>(null)

  const tenantId = typeof id === 'string' || typeof id === 'number' ? String(id) : null
  const { target, loading, refresh } = useTenantDeployTarget(tenantId)

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
              : `Request failed: ${res.status} ${res.statusText}`,
        runsUrl: body.runsUrl ?? null,
        runUrl: body.runUrl ?? null,
        ciProvider: body.ciProvider,
        deployMode: body.deployMode,
        deployTarget: body.deployTarget,
      })
      if (action === 'publish' && body.ok) refresh()
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
        margin: '16px 0 24px',
        background: 'var(--theme-elevation-50, #f9fafb)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Publish & deploy</div>

      {!disabled && !loading && target ? (
        <div style={{ marginBottom: 10 }}>
          <DeployTargetBadge mode={target.mode} label={target.label} />
          {target.mode === 'external' && target.githubSetupStatus && target.githubSetupStatus !== 'ready' ? (
            <div style={{ fontSize: 12, color: 'var(--theme-elevation-500, #6b7280)', marginTop: 6 }}>
              GitHub setup: {target.githubSetupStatus.replace(/_/g, ' ')} — merge the setup PR or validate the repo.
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ fontSize: 13, color: 'var(--theme-elevation-500, #6b7280)', marginBottom: 12 }}>
        {disabled
          ? 'Save the tenant first.'
          : target?.mode === 'external'
            ? 'Saving blog posts only updates the CMS. Publish syncs markdown into the connected GitHub repo at build time (not committed back by default).'
            : 'Saving blog posts only updates the CMS. Publish syncs into apps/sites/<slug> and deploys from the monorepo.'}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => run('publish')}
          style={{
            ...buttonStyle(disabled || busy !== null),
            background: 'var(--theme-success-500, #16a34a)',
            color: '#fff',
            borderColor: 'transparent',
            fontWeight: 600,
          }}
        >
          {busy === 'publish' ? 'Publishing…' : 'Publish content to live site'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--theme-elevation-500, #6b7280)', marginBottom: 8 }}>
        Super-admin only
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => run('scaffold')}
          style={buttonStyle(disabled || busy !== null)}
        >
          {busy === 'scaffold' ? 'Dispatching…' : 'Scaffold tenant code'}
        </button>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => run('deploy')}
          style={buttonStyle(disabled || busy !== null)}
        >
          {busy === 'deploy' ? 'Dispatching…' : 'Redeploy (code + content)'}
        </button>
      </div>

      {result ? (
        <div style={publishResultBox(result.ok)} role="status">
          <div style={{ fontWeight: 600, marginBottom: result.message ? 4 : 0 }}>
            {result.kind === 'publish'
              ? result.ok
                ? 'Publish started'
                : 'Publish failed'
              : result.kind === 'scaffold'
                ? result.ok
                  ? 'Scaffold started'
                  : 'Scaffold failed'
                : result.ok
                  ? 'Redeploy started'
                  : 'Redeploy failed'}
          </div>
          <div>{result.message}</div>
          {result.runUrl ? (
            <div style={{ marginTop: 8 }}>
              <a href={result.runUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 500 }}>
                {ciTrackBuildLabel(result.ciProvider, result.runUrl)}
              </a>
            </div>
          ) : result.runsUrl ? (
            <div style={{ marginTop: 8 }}>
              <a href={result.runsUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 500 }}>
                {ciViewRunsLabel(result.ciProvider, result.runsUrl)}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default TenantActions

function buttonStyle(isDisabled: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 4,
    border: '1px solid var(--theme-elevation-200, #d1d5db)',
    background: 'var(--theme-elevation-0, #ffffff)',
    color: 'var(--theme-text, #111827)',
    fontSize: 14,
    fontWeight: 500,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
  }
}
