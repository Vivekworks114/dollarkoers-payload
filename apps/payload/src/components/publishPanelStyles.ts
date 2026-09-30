/** Shared layout tokens for Live site / publish panels in the admin UI. */

export const publishPanelCard: React.CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid var(--theme-elevation-150, #e5e7eb)',
  background: 'var(--theme-elevation-50, #f9fafb)',
  padding: '16px 20px',
  marginBottom: 8,
  position: 'relative',
}

export const publishPrimaryButton = (disabled: boolean): React.CSSProperties => ({
  flexShrink: 0,
  padding: '10px 16px',
  borderRadius: 6,
  border: 'none',
  background: disabled ? 'var(--theme-elevation-250, #9ca3af)' : 'var(--theme-success-500, #16a34a)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.25,
  cursor: disabled ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap',
})

export const publishResultBox = (ok: boolean): React.CSSProperties => ({
  marginTop: 14,
  padding: '12px 14px',
  borderRadius: 6,
  fontSize: 13,
  lineHeight: 1.5,
  border: `1px solid ${ok ? 'var(--theme-success-200, #bbf7d0)' : 'var(--theme-error-200, #fecaca)'}`,
  background: ok ? 'var(--theme-success-50, #dcfce7)' : 'var(--theme-error-50, #fee2e2)',
  color: ok ? 'var(--theme-success-900, #14532d)' : 'var(--theme-error-900, #7f1d1d)',
})
