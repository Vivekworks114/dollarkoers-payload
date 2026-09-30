import type { CiProviderId } from './types'

export function isJenkinsCiUrl(url?: string | null): boolean {
  if (!url) return false
  try {
    return new URL(url).pathname.includes('/job/')
  } catch {
    return /\/job\//.test(url)
  }
}

function useJenkins(provider?: CiProviderId | null, url?: string | null): boolean {
  if (provider === 'jenkins') return true
  if (provider === 'github_actions') return false
  return isJenkinsCiUrl(url)
}

/** Label for a single build/run link after publish, deploy, or scaffold. */
export function ciTrackBuildLabel(provider?: CiProviderId | null, url?: string | null): string {
  return useJenkins(provider, url) ? 'Track build on Jenkins →' : 'Track build on GitHub →'
}

/** Label when only the job/workflow index URL is available. */
export function ciViewRunsLabel(provider?: CiProviderId | null, url?: string | null): string {
  return useJenkins(provider, url) ? 'View job runs on Jenkins →' : 'View workflow runs on GitHub →'
}

/** Shorter label for import/setup actions. */
export function ciViewRunLabel(provider?: CiProviderId | null, url?: string | null): string {
  return useJenkins(provider, url) ? 'View Jenkins build →' : 'View workflow run →'
}

/** Label for stored lastDeployRunUrl on tenant edit view. */
export function ciViewLatestRunLabel(provider?: CiProviderId | null, url?: string | null): string {
  return useJenkins(provider, url) ? 'View Jenkins build →' : 'View GitHub Actions run →'
}

export type { CiProviderId }
