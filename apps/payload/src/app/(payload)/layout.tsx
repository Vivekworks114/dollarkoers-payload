/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import config from '@payload-config'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import type { ServerFunctionClient } from 'payload'
import React from 'react'

import '@payloadcms/next/css'

import { isPayloadApiDebug, payloadLog } from '../../lib/payloadLogger'

import { importMap } from './admin/importMap.js'

type Args = {
  children: React.ReactNode
}

function describeServerFnArgs(args: Record<string, unknown>): string {
  const keys = ['fnKey', 'key', 'name', 'functionName', 'slug', 'collectionSlug', 'operation']
  for (const k of keys) {
    const v = args[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return Object.keys(args).slice(0, 6).join(',') || 'unknown'
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  const label = describeServerFnArgs(args as Record<string, unknown>)
  const start = Date.now()
  const debug = isPayloadApiDebug()

  if (debug) payloadLog.info('admin.server_fn.start', { fn: label })

  try {
    const result = await handleServerFunctions({
      ...args,
      config,
      importMap,
    })
    if (debug) payloadLog.info('admin.server_fn.ok', { fn: label, ms: Date.now() - start })
    return result
  } catch (err) {
    payloadLog.error('admin.server_fn.error', { fn: label, ms: Date.now() - start }, err)
    throw err
  }
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
