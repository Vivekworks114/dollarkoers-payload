import { isPayloadApiDebug, payloadLog } from './lib/payloadLogger'

/**
 * Next.js hook — logs unhandled request errors (including failed Server Actions).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function onRequestError(
  err: Error,
  request: { path: string; method: string; headers: { [key: string]: string } },
  context: { routerKind: string; routePath: string; routeType: string },
): Promise<void> {
  if (!isPayloadApiDebug() && process.env.NODE_ENV === 'production') return

  payloadLog.error(
    'next.request_error',
    {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
    },
    err,
  )
}
