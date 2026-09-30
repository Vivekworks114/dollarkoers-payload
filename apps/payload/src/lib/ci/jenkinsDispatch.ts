/**
 * Trigger Jenkins parameterized builds via the remote API.
 *
 * Env:
 *   JENKINS_URL          — e.g. https://jenkins.example.com
 *   JENKINS_USER         — API user
 *   JENKINS_API_TOKEN    — API token (not password)
 *   JENKINS_JOB_*        — per-job name (see types.ts)
 */

import {
  defaultJenkinsJobName,
  jenkinsJobNameEnvKey,
  type CiDispatchResult,
  type CiJobKey,
} from './types'

function jenkinsBase(): { url: string; user: string; token: string } | null {
  const url = process.env.JENKINS_URL?.trim()
  const user = process.env.JENKINS_USER?.trim()
  const token = process.env.JENKINS_API_TOKEN?.trim()
  if (!url || !user || !token) return null
  return { url: url.replace(/\/+$/, ''), user, token }
}

function basicAuth(user: string, token: string): string {
  return `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`
}

/** Turn `dollarkoers/tenant-deploy` → `/job/dollarkoers/job/tenant-deploy` */
export function jenkinsJobPath(jobName: string): string {
  const parts = jobName.split('/').filter(Boolean)
  return `/job/${parts.join('/job/')}`
}

function resolveJobName(job: CiJobKey): string {
  const envKey = jenkinsJobNameEnvKey(job)
  return process.env[envKey]?.trim() || defaultJenkinsJobName(job)
}

function jobRunsUrl(baseUrl: string, jobName: string): string {
  return `${baseUrl}${jenkinsJobPath(jobName)}/`
}

async function fetchCrumb(
  baseUrl: string,
  auth: string,
): Promise<{ field: string; value: string } | null> {
  try {
    const res = await fetch(`${baseUrl}/crumbIssuer/api/json`, {
      headers: { Authorization: auth },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { crumbRequestField?: string; crumb?: string }
    if (data.crumbRequestField && data.crumb) {
      return { field: data.crumbRequestField, value: data.crumb }
    }
  } catch {
    /* optional */
  }
  return null
}

async function waitForBuildUrl(
  baseUrl: string,
  jobName: string,
  queueUrl: string,
  auth: string,
  maxAttempts = 20,
  delayMs = 1500,
): Promise<string | null> {
  const apiUrl = queueUrl.endsWith('/')
    ? `${queueUrl}api/json`
    : `${queueUrl}/api/json`

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs))
    try {
      const res = await fetch(apiUrl, { headers: { Authorization: auth } })
      if (!res.ok) continue
      const data = (await res.json()) as {
        executable?: { number?: number; url?: string }
        cancelled?: boolean
      }
      if (data.cancelled) return null
      if (data.executable?.url) return data.executable.url
      if (data.executable?.number != null) {
        return `${baseUrl}${jenkinsJobPath(jobName)}/${data.executable.number}/`
      }
    } catch {
      /* retry */
    }
  }
  return null
}

export async function dispatchJenkinsJob(
  job: CiJobKey,
  parameters: Record<string, string>,
): Promise<CiDispatchResult> {
  const base = jenkinsBase()
  if (!base) {
    return {
      ok: false,
      status: 500,
      error:
        'Jenkins is not configured. Set JENKINS_URL, JENKINS_USER, and JENKINS_API_TOKEN in apps/payload/.env.',
    }
  }

  const jobName = resolveJobName(job)
  const runsUrl = jobRunsUrl(base.url, jobName)
  const auth = basicAuth(base.user, base.token)
  const triggerUrl = `${base.url}${jenkinsJobPath(jobName)}/buildWithParameters`

  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(parameters)) {
    if (value != null && value !== '') body.set(key, value)
  }

  const headers: Record<string, string> = {
    Authorization: auth,
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  const crumb = await fetchCrumb(base.url, auth)
  if (crumb) headers[crumb.field] = crumb.value

  let res: Response
  try {
    res = await fetch(triggerUrl, { method: 'POST', headers, body: body.toString() })
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: `Could not reach Jenkins: ${err instanceof Error ? err.message : String(err)}`,
      runsUrl,
    }
  }

  if (res.status !== 201 && res.status !== 200 && res.status !== 302) {
    const text = await res.text().catch(() => '')
    const notParameterized =
      res.status === 400 && /not parameterized/i.test(text)
    return {
      ok: false,
      status: res.status,
      error: notParameterized
        ? `Jenkins job "${jobName}" is not parameterized yet. Open the job in Jenkins, run "Build Now" once (so the Jenkinsfile parameters load), then retry from Payload.`
        : `Jenkins returned ${res.status}: ${text.slice(0, 500) || res.statusText}`,
      runsUrl,
    }
  }

  const location = res.headers.get('location')
  let runUrl: string | null = null
  if (location) {
    const queueUrl = location.startsWith('http') ? location : `${base.url}${location}`
    runUrl = await waitForBuildUrl(base.url, jobName, queueUrl, auth)
  }

  return {
    ok: true,
    status: 201,
    runUrl: runUrl ?? runsUrl,
    runsUrl,
  }
}
