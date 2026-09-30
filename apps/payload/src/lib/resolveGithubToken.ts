import type { Payload } from 'payload'

import { decryptSecret } from './credentialEncryption'

export type GithubTokenSource =
  | 'tenant-credential'
  | 'external-repo-env'
  | 'payload-github-env'

export interface ResolvedGithubToken {
  token: string
  source: GithubTokenSource
}

type GithubCredentialRef =
  | number
  | string
  | {
      id?: number | string
      tokenEncrypted?: string | null
    }
  | null
  | undefined

export interface TenantGithubAuth {
  slug?: string | null
  githubCredential?: GithubCredentialRef
}

async function loadCredentialToken(
  payload: Payload,
  ref: GithubCredentialRef,
): Promise<string | null> {
  if (ref == null || ref === '') return null

  if (typeof ref === 'object' && ref.tokenEncrypted) {
    try {
      return decryptSecret(ref.tokenEncrypted)
    } catch {
      return null
    }
  }

  const id = typeof ref === 'object' ? ref.id : ref
  if (id == null || id === '') return null

  try {
    const doc = (await payload.findByID({
      collection: 'github-credentials',
      id,
      depth: 0,
      overrideAccess: true,
    })) as { tokenEncrypted?: string | null } | null
    if (!doc?.tokenEncrypted) return null
    return decryptSecret(doc.tokenEncrypted)
  } catch {
    return null
  }
}

/** Platform fallbacks — same order CI uses when no tenant credential is set. */
export function resolvePlatformGithubToken(): ResolvedGithubToken | null {
  const external = process.env.EXTERNAL_REPO_GITHUB_TOKEN?.trim()
  if (external) {
    return { token: external, source: 'external-repo-env' }
  }

  const platform = process.env.GITHUB_TOKEN?.trim()
  if (platform) {
    return { token: platform, source: 'payload-github-env' }
  }

  return null
}

/**
 * Resolve a GitHub PAT for checking out / validating a tenant's external repo.
 * 1. Tenant-linked credential (encrypted in DB)
 * 2. EXTERNAL_REPO_GITHUB_TOKEN on Payload (optional mirror of GitHub secret)
 * 3. GITHUB_TOKEN on Payload (legacy)
 */
export async function resolveGithubTokenForTenant(
  payload: Payload,
  tenant: TenantGithubAuth,
): Promise<ResolvedGithubToken | null> {
  const fromCredential = await loadCredentialToken(payload, tenant.githubCredential)
  if (fromCredential) {
    return { token: fromCredential, source: 'tenant-credential' }
  }

  return resolvePlatformGithubToken()
}
