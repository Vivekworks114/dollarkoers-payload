'use client'

import { useCallback, useEffect, useState } from 'react'

import { getTenantDeployTargetInfo } from '../lib/tenantDeployTarget'
import type { DeployMode } from '../lib/tenantDeployTarget'

export type TenantDeployTargetState = {
  mode: DeployMode
  label: string
  shortLabel: string
  githubSetupStatus?: string | null
}

export function useTenantDeployTarget(tenantId: string | null | undefined): {
  target: TenantDeployTargetState | null
  loading: boolean
  refresh: () => void
} {
  const [target, setTarget] = useState<TenantDeployTargetState | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    if (!tenantId) {
      setTarget(null)
      return
    }
    setLoading(true)
    void fetch(`/api/tenants/${encodeURIComponent(tenantId)}?depth=0`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (doc: {
          slug?: string
          githubRepo?: string | null
          githubBranch?: string | null
          blogContentPath?: string | null
          githubSetupStatus?: string | null
        } | null) => {
          if (!doc?.slug) {
            setTarget(null)
            return
          }
          const info = getTenantDeployTargetInfo(doc)
          if (!info) {
            setTarget(null)
            return
          }
          setTarget({
            mode: info.mode,
            label: info.label,
            shortLabel: info.shortLabel,
            githubSetupStatus: doc.githubSetupStatus,
          })
        },
      )
      .catch(() => setTarget(null))
      .finally(() => setLoading(false))
  }, [tenantId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { target, loading, refresh }
}
