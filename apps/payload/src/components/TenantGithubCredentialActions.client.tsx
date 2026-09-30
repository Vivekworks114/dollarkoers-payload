'use client'

import { useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'

type CredentialSummary = {
  id: number
  label: string
  tokenLast4?: string | null
  githubOwner?: string | null
}

type ActionResult = { ok: boolean; message: string }

function credentialIdFromValue(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number') return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id)
  }
  return null
}

/**
 * Actions card for the tenant GitHub credential relationship field.
 */
export function TenantGithubCredentialActions(): React.ReactElement | null {
  const { id: tenantId } = useDocumentInfo()
  const credentialValue = useFormFields(([fields]) => fields.githubCredential?.value)
  const { setValue: setCredential } = useField<number | null>({ path: 'githubCredential' })

  const credentialId = credentialIdFromValue(credentialValue)
  const [summary, setSummary] = useState<CredentialSummary | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<ActionResult | null>(null)

  useEffect(() => {
    if (!credentialId) {
      setSummary(null)
      return
    }
    if (typeof credentialValue === 'object' && credentialValue !== null && 'label' in credentialValue) {
      const row = credentialValue as CredentialSummary
      setSummary({
        id: credentialId,
        label: String(row.label ?? ''),
        tokenLast4: row.tokenLast4 ?? null,
        githubOwner: row.githubOwner ?? null,
      })
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/github-credentials/${credentialId}?depth=0`, {
          credentials: 'include',
        })
        if (!res.ok) return
        const doc = (await res.json()) as CredentialSummary
        if (!cancelled) setSummary(doc)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [credentialId, credentialValue])

  const runAction = useCallback(
    async (action: string) => {
      if (!credentialId) return
      setBusy(action)
      setResult(null)

      try {
        if (action === 'edit') {
          window.open(`/admin/collections/github-credentials/${credentialId}`, '_blank')
          setBusy(null)
          return
        }

        if (action === 'clear-token') {
          if (
            !window.confirm(
              'Remove the stored PAT from this credential? Linked tenants will use platform tokens until a new PAT is saved.',
            )
          ) {
            setBusy(null)
            return
          }
          const res = await fetch(`/api/github-credentials/${credentialId}/clear-token`, {
            method: 'POST',
            credentials: 'include',
          })
          const body = (await res.json().catch(() => ({}))) as Partial<ActionResult>
          setResult({
            ok: Boolean(body.ok),
            message: typeof body.message === 'string' ? body.message : 'Done.',
          })
          if (body.ok) {
            setSummary((s) => (s ? { ...s, tokenLast4: null } : s))
          }
          setBusy(null)
          return
        }

        if (action === 'unlink') {
          setCredential(null)
          setResult({ ok: true, message: 'Credential unlinked. Save the tenant to apply.' })
          setBusy(null)
          return
        }

        if (action === 'delete') {
          if (
            !window.confirm(
              'Delete this GitHub credential permanently? Tenants linked to it will need a new selection.',
            )
          ) {
            setBusy(null)
            return
          }
          const res = await fetch(`/api/github-credentials/${credentialId}`, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (!res.ok) {
            setResult({ ok: false, message: `Delete failed (${res.status}).` })
          } else {
            setCredential(null)
            setSummary(null)
            setResult({ ok: true, message: 'Credential deleted. Save the tenant to apply.' })
          }
          setBusy(null)
        }
      } catch (err) {
        setResult({
          ok: false,
          message: err instanceof Error ? err.message : 'Network error.',
        })
        setBusy(null)
      }
    },
    [credentialId, setCredential],
  )

  if (!tenantId || !credentialId || !summary) return null

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150, #e5e7eb)',
        borderRadius: 6,
        padding: '12px 16px',
        marginBottom: 20,
        background: 'var(--theme-elevation-50, #f9fafb)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>GitHub credential</div>
      <div style={{ fontSize: 13, marginBottom: 10 }}>
        <strong>{summary.label}</strong>
        {summary.githubOwner ? ` · ${summary.githubOwner}` : ''}
        {summary.tokenLast4 ? (
          <> · token ••••{summary.tokenLast4}</>
        ) : (
          <span style={{ color: 'var(--theme-warning-500, #b45309)' }}> · no token stored</span>
        )}
      </div>

      <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }} htmlFor="gh-cred-actions">
        Actions
      </label>
      <select
        id="gh-cred-actions"
        defaultValue=""
        disabled={busy !== null}
        onChange={(e) => {
          const action = e.target.value
          e.target.value = ''
          if (action) void runAction(action)
        }}
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '8px 10px',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-150, #d1d5db)',
        }}
      >
        <option value="">Choose an action…</option>
        <option value="edit">Edit / replace token…</option>
        <option value="clear-token">Delete stored token</option>
        <option value="unlink">Unlink (use platform token)</option>
        <option value="delete">Delete credential…</option>
      </select>

      {result ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            padding: 10,
            borderRadius: 4,
            background: result.ok
              ? 'var(--theme-success-100, #ecfdf5)'
              : 'var(--theme-error-100, #fef2f2)',
          }}
        >
          {result.message}
        </div>
      ) : null}
    </div>
  )
}
