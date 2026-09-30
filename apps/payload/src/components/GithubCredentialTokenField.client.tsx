'use client'

import { FieldLabel, useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import { useCallback, useState } from 'react'

type ActionResult = { ok: boolean; message: string }

/**
 * Editable PAT entry (ui field). Syncs to virtual `token` for beforeChange encryption on Save.
 */
export function GithubCredentialTokenPanel(): React.ReactElement {
  const { id } = useDocumentInfo()
  const { value, setValue } = useField<string>({ path: 'token' })
  const tokenLast4 = useFormFields(([fields]) => {
    const v = fields.tokenLast4?.value
    return typeof v === 'string' ? v : ''
  })

  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)

  const hasStored = Boolean(tokenLast4)
  const credentialId = typeof id === 'string' || typeof id === 'number' ? String(id) : null
  const textValue = typeof value === 'string' ? value : ''

  const clearStoredToken = useCallback(async () => {
    if (!credentialId) return
    if (
      !window.confirm(
        'Remove the stored token? Tenants using this credential will fall back to platform tokens until you save a new PAT.',
      )
    ) {
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(
        `/api/github-credentials/${encodeURIComponent(credentialId)}/clear-token`,
        { method: 'POST', credentials: 'include' },
      )
      const body = (await res.json().catch(() => ({}))) as Partial<ActionResult>
      setResult({
        ok: Boolean(body.ok),
        message:
          typeof body.message === 'string'
            ? body.message
            : res.ok
              ? 'Token removed.'
              : `Request failed (${res.status}).`,
      })
      if (body.ok) {
        setValue('')
        window.location.reload()
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Network error.',
      })
    } finally {
      setBusy(false)
    }
  }, [credentialId, setValue])

  return (
    <div className="field-type text" style={{ marginBottom: 20 }}>
      <FieldLabel label="Token" required={!credentialId} />

      {hasStored ? (
        <p style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--theme-elevation-600, #9ca3af)' }}>
          Stored token ends with <strong>••••{tokenLast4}</strong>. Paste a new PAT below to replace
          it, then click <strong>Save</strong>.
        </p>
      ) : (
        <p style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--theme-warning-500, #fbbf24)' }}>
          {credentialId
            ? 'No token stored. Paste a GitHub PAT below and click Save.'
            : 'Paste a GitHub PAT below, then click Save to create this credential.'}
        </p>
      )}

      <input
        type="password"
        name="token"
        autoComplete="new-password"
        disabled={busy}
        value={textValue}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ghp_… or github_pat_…"
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-250, #6b7280)',
          background: 'var(--theme-elevation-0, #1f2937)',
          color: 'var(--theme-elevation-1000, #f9fafb)',
          cursor: 'text',
        }}
      />

      <p style={{ fontSize: 12, margin: '8px 0 0', color: 'var(--theme-elevation-500, #9ca3af)' }}>
        Write-only — encrypted on save. Leave blank when editing to keep the current token.
      </p>

      {credentialId ? (
        <button
          type="button"
          disabled={busy || !hasStored}
          onClick={() => void clearStoredToken()}
          style={{ marginTop: 12 }}
        >
          {busy ? 'Removing…' : 'Delete stored token'}
        </button>
      ) : null}

      {result ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            padding: 10,
            borderRadius: 4,
            background: result.ok
              ? 'var(--theme-success-100, #064e3b)'
              : 'var(--theme-error-100, #7f1d1d)',
          }}
        >
          {result.message}
        </div>
      ) : null}
    </div>
  )
}
