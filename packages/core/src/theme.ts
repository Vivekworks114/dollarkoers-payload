import type { ThemeTokens } from './types'

/**
 * Emit a `:root { --primary: ...; }` CSS rule from a tenant's theme tokens.
 * Used in BaseLayout to override the default palette per tenant without a
 * recompile of Tailwind.
 */
export function themeTokensToCssVars(tokens: ThemeTokens | undefined): string {
  if (!tokens) return ''
  const entries: Array<[string, string | undefined]> = [
    ['--color-primary', tokens.primary],
    ['--color-primary-dark', tokens.primaryDark],
    ['--color-accent', tokens.accent],
    ['--color-background', tokens.background],
    ['--color-text', tokens.text],
    ['--color-muted', tokens.muted],
    ['--font-heading', tokens.fontHeading],
    ['--font-body', tokens.fontBody],
    ['--radius', tokens.radius],
  ]
  const declarations = entries
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  if (!declarations) return ''
  return `:root {\n${declarations}\n}`
}
