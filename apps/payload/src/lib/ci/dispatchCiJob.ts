import type { Payload } from 'payload'

import {
  dispatchWorkflowResilient,
  isWorkflowUnexpectedInputsError,
  workflowRunsUrl,
} from '../githubDispatch'

import { dispatchJenkinsJob } from './jenkinsDispatch'
import { resolveCiProvider } from './resolveCiProvider'
import {
  githubWorkflowForJob,
  type CiDispatchResult,
  type CiJobDispatchOptions,
} from './types'

export type { CiDispatchResult, CiJobDispatchOptions, CiJobKey } from './types'
export { resolveCiProvider, isJenkinsConfigured } from './resolveCiProvider'
export { jenkinsJobPath } from './jenkinsDispatch'

/**
 * Dispatch a tenant pipeline job to Jenkins or GitHub Actions (platform setting / env).
 */
export async function dispatchCiJob(
  opts: CiJobDispatchOptions,
  payload?: Payload,
): Promise<CiDispatchResult> {
  const provider = await resolveCiProvider(payload)

  if (provider === 'jenkins') {
    const result = await dispatchJenkinsJob(opts.job, opts.parameters)
    return { ...result, ciProvider: provider }
  }

  const workflow = githubWorkflowForJob(opts.job)
  const result = await dispatchWorkflowResilient({
    workflow,
    inputs: opts.parameters,
    ref: opts.ref,
    legacyInputKeys: opts.legacyParameterKeys,
  })

  return {
    ok: result.ok,
    status: result.status,
    error: result.error,
    runUrl: result.runUrl,
    runsUrl: result.runUrl ?? workflowRunsUrl(workflow),
    usedLegacyWorkflowInputs: result.usedLegacyWorkflowInputs,
    ciProvider: provider,
  }
}

export { isWorkflowUnexpectedInputsError, workflowRunsUrl }
