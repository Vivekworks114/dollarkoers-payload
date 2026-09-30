'use client'

import { useFormFields } from '@payloadcms/ui'

import { ciViewLatestRunLabel } from '../lib/ci/ciBuildLinks'
import { productionUrlFromDomain } from '../lib/tenantDeployStatus'

/**
 * Read-only summary of live / preview URLs and latest deploy status.
 */
export function TenantDeployLinks(): React.ReactElement {
  const domain = useFormFields(([fields]) => fields.domain?.value) as string | undefined
  const workersDevUrl = useFormFields(([fields]) => fields.workersDevUrl?.value) as string | undefined
  const previewUrl = useFormFields(([fields]) => fields.previewUrl?.value) as string | undefined
  const lastDeployStatus = useFormFields(([fields]) => fields.lastDeployStatus?.value) as
    | string
    | undefined
  const lastDeployAt = useFormFields(([fields]) => fields.lastDeployAt?.value) as string | undefined
  const lastPublishedAt = useFormFields(([fields]) => fields.lastPublishedAt?.value) as string | undefined
  const lastDeployRunUrl = useFormFields(([fields]) => fields.lastDeployRunUrl?.value) as
    | string
    | undefined
  const lastDeployError = useFormFields(([fields]) => fields.lastDeployError?.value) as
    | string
    | undefined

  const productionUrl = productionUrlFromDomain(domain)

  const boxStyle: React.CSSProperties = {
    border: '1px solid var(--theme-elevation-150, #e5e7eb)',
    borderRadius: 6,
    padding: '16px 20px',
    margin: '0 0 24px',
    background: 'var(--theme-elevation-50, #f9fafb)',
  }

  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Site URLs</div>
      <UrlRow label="Production" url={productionUrl} hint="Requires custom domain in Cloudflare Workers." />
      <UrlRow label="Workers.dev" url={workersDevUrl} hint="Available immediately after a successful deploy." />
      <UrlRow label="Preview" url={previewUrl ?? workersDevUrl} hint="Smoke-test before DNS cutover." />
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Latest deploy</div>
        <StatusLine
          status={lastDeployStatus}
          at={lastPublishedAt ?? lastDeployAt}
          label="Last published"
        />
        {lastDeployRunUrl ? (
          <div style={{ marginTop: 6 }}>
            <a href={lastDeployRunUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
              {ciViewLatestRunLabel(undefined, lastDeployRunUrl)}
            </a>
          </div>
        ) : null}
        {lastDeployError ? (
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 4,
              background: 'var(--theme-error-50, #fee2e2)',
              color: 'var(--theme-error-900, #7f1d1d)',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {lastDeployError}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function UrlRow({
  label,
  url,
  hint,
}: {
  label: string
  url: string | null | undefined
  hint?: string
}): React.ReactElement {
  return (
    <div style={{ marginBottom: 10, fontSize: 13 }}>
      <div style={{ color: 'var(--theme-elevation-500, #6b7280)', marginBottom: 2 }}>{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
          {url}
        </a>
      ) : (
        <div style={{ color: 'var(--theme-elevation-400, #9ca3af)' }}>—</div>
      )}
      {hint ? (
        <div style={{ color: 'var(--theme-elevation-400, #9ca3af)', fontSize: 12, marginTop: 2 }}>{hint}</div>
      ) : null}
    </div>
  )
}

function StatusLine({
  status,
  at,
  label: heading = 'Status',
}: {
  status?: string
  at?: string
  label?: string
}): React.ReactElement {
  const statusLabel = status && status !== 'idle' ? status : 'not published yet'
  const when = at && typeof at === 'string' ? new Date(at).toLocaleString() : null
  return (
    <div style={{ fontSize: 13 }}>
      <span style={{ color: 'var(--theme-elevation-500, #6b7280)' }}>{heading}: </span>
      <strong>{statusLabel}</strong>
      {when ? <span style={{ color: 'var(--theme-elevation-500, #6b7280)' }}> · {when}</span> : null}
    </div>
  )
}

export default TenantDeployLinks