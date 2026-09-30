import React from 'react'

/** Full logo on the admin login screen. */
export function AdminLogo() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.35rem',
        lineHeight: 1.2,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        DollarKoers
      </span>
      <span
        style={{
          fontSize: '0.8rem',
          opacity: 0.7,
          fontWeight: 500,
        }}
      >
        Content platform
      </span>
    </div>
  )
}

/** Compact mark in the admin nav. */
export function AdminIcon() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.75rem',
        height: '1.75rem',
        borderRadius: '0.35rem',
        background: 'var(--theme-elevation-800, #1a1a1a)',
        color: 'var(--theme-elevation-0, #fff)',
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '-0.03em',
        userSelect: 'none',
      }}
      aria-label="DollarKoers"
    >
      DK
    </span>
  )
}
