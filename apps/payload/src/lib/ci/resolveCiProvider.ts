import type { Payload } from 'payload'

import type { CiProviderId } from './types'

const VALID: CiProviderId[] = ['jenkins', 'github_actions']

function normalizeProvider(value: unknown): CiProviderId | null {
  if (value === 'jenkins' || value === 'github_actions') return value
  return null
}

/**
 * Resolve CI backend:
 * 1. Platform Settings global (super-admin)
 * 2. CI_PROVIDER env
 * 3. JENKINS_URL set → jenkins, else github_actions
 */
export async function resolveCiProvider(payload?: Payload): Promise<CiProviderId> {
  if (payload) {
    try {
      const settings = await payload.findGlobal({
        slug: 'platform-settings',
        depth: 0,
        overrideAccess: true,
      })
      const fromGlobal = normalizeProvider((settings as { ciProvider?: unknown })?.ciProvider)
      if (fromGlobal) return fromGlobal
    } catch {
      /* global may not exist yet during migration */
    }
  }

  const fromEnv = normalizeProvider(process.env.CI_PROVIDER?.trim().toLowerCase())
  if (fromEnv && VALID.includes(fromEnv)) return fromEnv

  if (process.env.JENKINS_URL?.trim()) return 'jenkins'

  return 'github_actions'
}

export function isJenkinsConfigured(): boolean {
  return Boolean(
    process.env.JENKINS_URL?.trim() &&
      process.env.JENKINS_USER?.trim() &&
      process.env.JENKINS_API_TOKEN?.trim(),
  )
}
