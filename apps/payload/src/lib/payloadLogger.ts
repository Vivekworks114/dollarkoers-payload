/**
 * Structured logs for Payload API + admin server functions (pm2 / docker stdout).
 * Enable in production: PAYLOAD_DEBUG_API=1
 */

export function isPayloadApiDebug(): boolean {
  return (
    process.env.PAYLOAD_DEBUG_API === '1' ||
    process.env.PAYLOAD_DEBUG_AUTH === '1' ||
    process.env.NODE_ENV !== 'production'
  )
}

function ts(): string {
  return new Date().toISOString()
}

function formatErr(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack }
  }
  return { message: String(err) }
}

export const payloadLog = {
  info(event: string, data?: Record<string, unknown>): void {
    if (!isPayloadApiDebug()) return
    console.log(`[payload] ${ts()} ${event}`, data ? JSON.stringify(data) : '')
  },

  warn(event: string, data?: Record<string, unknown>): void {
    console.warn(`[payload] ${ts()} ${event}`, data ? JSON.stringify(data) : '')
  },

  error(event: string, data?: Record<string, unknown>, err?: unknown): void {
    const base = { ...data, ...(err !== undefined ? { error: formatErr(err) } : {}) }
    console.error(`[payload] ${ts()} ${event}`, Object.keys(base).length ? JSON.stringify(base) : '')
  },

  /** Always logged — use for tenant save/delete (production PM2). */
  tenant(event: string, data?: Record<string, unknown>, err?: unknown): void {
    const base = { ...data, ...(err !== undefined ? { error: formatErr(err) } : {}) }
    const line = Object.keys(base).length ? JSON.stringify(base) : ''
    if (err !== undefined) {
      console.error(`[payload-tenant] ${ts()} ${event}`, line)
    } else {
      console.log(`[payload-tenant] ${ts()} ${event}`, line)
    }
  },
}
