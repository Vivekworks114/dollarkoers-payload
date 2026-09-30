'use client'

import type { DeployMode } from '../lib/tenantDeployTarget'

const MODE_STYLES: Record<DeployMode, { bg: string; color: string; border: string }> = {
  monorepo: {
    bg: 'var(--theme-elevation-100, #f3f4f6)',
    color: 'var(--theme-elevation-800, #1f2937)',
    border: 'var(--theme-elevation-200, #e5e7eb)',
  },
  external: {
    bg: 'var(--theme-success-50, #ecfdf5)',
    color: 'var(--theme-success-900, #14532d)',
    border: 'var(--theme-success-200, #bbf7d0)',
  },
}

export function DeployTargetBadge(props: {
  mode: DeployMode
  label: string
  compact?: boolean
}): React.ReactElement {
  const style = MODE_STYLES[props.mode]
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: props.compact ? '4px 8px' : '6px 10px',
        borderRadius: 4,
        fontSize: props.compact ? 12 : 13,
        fontWeight: 500,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        maxWidth: '100%',
      }}
    >
      <span style={{ opacity: 0.85, fontWeight: 600 }}>
        {props.mode === 'external' ? 'External repo' : 'Monorepo'}
      </span>
      <span style={{ opacity: 0.7 }}>·</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{props.label}</span>
    </div>
  )
}

export default DeployTargetBadge
