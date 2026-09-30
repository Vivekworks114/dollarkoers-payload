import { addDataAndFileToRequest, type PayloadRequest } from 'payload'

/**
 * Read JSON body in custom collection endpoints.
 * Payload does not populate `req.data` automatically — use this helper.
 */
export async function parseEndpointJsonBody(
  req: PayloadRequest,
): Promise<Record<string, unknown>> {
  if (req.data && typeof req.data === 'object' && !Array.isArray(req.data)) {
    return req.data as Record<string, unknown>
  }

  await addDataAndFileToRequest(req)
  if (req.data && typeof req.data === 'object' && !Array.isArray(req.data)) {
    return req.data as Record<string, unknown>
  }

  if (typeof req.json === 'function') {
    try {
      return (await req.json()) as Record<string, unknown>
    } catch {
      /* fall through */
    }
  }

  return {}
}
