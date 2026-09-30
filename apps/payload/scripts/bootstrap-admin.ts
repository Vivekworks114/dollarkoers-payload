/**
 * One-shot bootstrap for a fresh DollarKoers Payload DB:
 *   1. Starts Payload (with PAYLOAD_DB_PUSH=1 this creates all tables)
 *   2. Creates the first super-admin if no users exist
 *
 * Usage on the VPS (from monorepo root):
 *
 *   cd /var/www/dollarkoers-payload/apps/payload
 *   # ensure .env has DATABASE_URI + PAYLOAD_SECRET + PAYLOAD_PUBLIC_SERVER_URL
 *   PAYLOAD_DB_PUSH=1 \
 *   BOOTSTRAP_EMAIL=admin@dollarkoers.nl \
 *   BOOTSTRAP_PASSWORD='choose-a-strong-password' \
 *   BOOTSTRAP_NAME='Admin' \
 *   pnpm exec tsx --env-file=.env scripts/bootstrap-admin.ts
 *
 * Then remove PAYLOAD_DB_PUSH from the environment / rebuild without it.
 */
import { getPayload } from 'payload'

async function main() {
  process.env.PAYLOAD_DB_PUSH ??= '1'

  const email = process.env.BOOTSTRAP_EMAIL?.trim()
  const password = process.env.BOOTSTRAP_PASSWORD
  const name = process.env.BOOTSTRAP_NAME?.trim() || 'Admin'

  if (!email || !password) {
    console.error(
      'Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD (and optionally BOOTSTRAP_NAME).',
    )
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('BOOTSTRAP_PASSWORD must be at least 8 characters.')
    process.exit(1)
  }

  if (!process.env.DATABASE_URI) {
    console.error('DATABASE_URI is missing (load apps/payload/.env).')
    process.exit(1)
  }
  if (!process.env.PAYLOAD_SECRET) {
    console.error('PAYLOAD_SECRET is missing.')
    process.exit(1)
  }

  console.log('[bootstrap] Starting Payload (push=%s)…', process.env.PAYLOAD_DB_PUSH)
  const { default: config } = await import('../src/payload.config.ts')
  const payload = await getPayload({ config })

  try {
    const existing = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.totalDocs > 0) {
      console.log(
        `[bootstrap] Users already exist (${existing.totalDocs}). Skipping create.`,
      )
      console.log('[bootstrap] Open https://payload.dollarkoers.nl/admin to log in.')
      return
    }

    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        name,
        roles: ['super-admin'],
      },
      overrideAccess: true,
    })

    console.log('[bootstrap] Created super-admin:', {
      id: user.id,
      email: user.email,
      roles: user.roles,
    })
    console.log(
      '[bootstrap] Done. Log in at the admin URL, then complete TOTP 2FA setup.',
    )
  } finally {
    await payload.db.destroy?.()
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('[bootstrap] Failed:', err)
  process.exit(1)
})
