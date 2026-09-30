/** Supported CI backends for tenant pipelines. */
export type CiProviderId = 'jenkins' | 'github_actions'

export interface CiDispatchResult {
  ok: boolean
  status: number
  error?: string
  runUrl?: string | null
  runsUrl?: string | null
  ciProvider?: CiProviderId
  /** GitHub-only: retried with legacy workflow inputs. */
  usedLegacyWorkflowInputs?: boolean
}

export interface CiJobDispatchOptions {
  /** Logical job key — mapped to workflow filename or Jenkins job name. */
  job: CiJobKey
  parameters: Record<string, string>
  /** GitHub workflow ref branch (ignored for Jenkins). */
  ref?: string
  /** GitHub-only fallback input keys when workflow is outdated. */
  legacyParameterKeys?: string[]
}

export type CiJobKey =
  | 'tenant-deploy'
  | 'tenant-import-blog'
  | 'tenant-repo-setup'
  | 'tenant-scaffold'

const GITHUB_WORKFLOW: Record<CiJobKey, string> = {
  'tenant-deploy': 'tenant-deploy.yml',
  'tenant-import-blog': 'tenant-import-blog.yml',
  'tenant-repo-setup': 'tenant-repo-setup.yml',
  'tenant-scaffold': 'tenant-scaffold.yml',
}

const JENKINS_JOB_ENV: Record<CiJobKey, string> = {
  'tenant-deploy': 'JENKINS_JOB_DEPLOY',
  'tenant-import-blog': 'JENKINS_JOB_IMPORT',
  'tenant-repo-setup': 'JENKINS_JOB_SETUP',
  'tenant-scaffold': 'JENKINS_JOB_SCAFFOLD',
}

export function githubWorkflowForJob(job: CiJobKey): string {
  return GITHUB_WORKFLOW[job]
}

export function jenkinsJobNameEnvKey(job: CiJobKey): string {
  return JENKINS_JOB_ENV[job]
}

export function defaultJenkinsJobName(job: CiJobKey): string {
  return job
}
