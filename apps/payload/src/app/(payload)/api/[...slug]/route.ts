import config from '@payload-config'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'

import { isPayloadApiDebug, payloadLog } from '../../../../lib/payloadLogger'

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

function debugWrap<T extends (...args: any[]) => Promise<Response> | Response>(
  method: string,
  handler: T,
): T {
  if (!isPayloadApiDebug()) return handler

  return (async (req: Request, ctx: any) => {
    const url = new URL(req.url)
    const path = url.pathname
    const isTenant = path.startsWith('/api/tenants')
    const shouldLog = MUTATING.has(method) || isTenant || path.includes('/users')

    if (!shouldLog) return handler(req, ctx)

    const headers = {
      origin: req.headers.get('origin'),
      host: req.headers.get('host'),
      referer: req.headers.get('referer'),
      cookie: req.headers.get('cookie') ? 'present' : 'missing',
      'content-type': req.headers.get('content-type'),
      'content-length': req.headers.get('content-length'),
    }

    payloadLog.info('api.request', { method, path, ...headers })

    const start = Date.now()
    try {
      const res = await handler(req, ctx)
      const ms = Date.now() - start

      let bodySnippet = ''
      const logBody =
        res.status >= 400 ||
        MUTATING.has(method) ||
        (isTenant && method === 'GET')

      if (logBody) {
        try {
          bodySnippet = (await res.clone().text()).slice(0, 800)
        } catch {
          bodySnippet = '<unreadable>'
        }
      }

      if (res.status >= 400) {
        payloadLog.error('api.response', { method, path, status: res.status, ms, body: bodySnippet })
      } else {
        payloadLog.info('api.response', {
          method,
          path,
          status: res.status,
          ms,
          ...(bodySnippet ? { body: bodySnippet } : {}),
        })
      }

      return res
    } catch (err) {
      payloadLog.error('api.exception', { method, path, ms: Date.now() - start }, err)
      throw err
    }
  }) as T
}

export const GET = debugWrap('GET', REST_GET(config))
export const POST = debugWrap('POST', REST_POST(config))
export const DELETE = debugWrap('DELETE', REST_DELETE(config))
export const PATCH = debugWrap('PATCH', REST_PATCH(config))
export const PUT = debugWrap('PUT', REST_PUT(config))
export const OPTIONS = debugWrap('OPTIONS', REST_OPTIONS(config))
