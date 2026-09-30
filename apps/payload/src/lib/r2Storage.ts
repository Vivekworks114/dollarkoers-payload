import { s3Storage } from '@payloadcms/storage-s3'
import type { Plugin } from 'payload'

/** True when S3 API credentials are present (uploads go to R2 instead of local disk). */
export function isR2StorageConfigured(): boolean {
  return Boolean(
    process.env.R2_BUCKET &&
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  )
}

function r2PublicBaseUrl(): string | undefined {
  const raw = process.env.R2_PUBLIC_URL?.trim()
  if (!raw) return undefined
  return raw.replace(/\/+$/, '')
}

/**
 * Cloudflare R2 via the S3-compatible API.
 *
 * Always registered (may be `enabled: false` when env vars are missing) so
 * `payload generate:importmap` includes storage-s3 components at build time.
 *
 * Requires R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
 * Set R2_PUBLIC_URL to the bucket public domain (*.r2.dev or custom CDN).
 */
export function r2StoragePlugin(): Plugin {
  const configured = isR2StorageConfigured()
  const bucket = process.env.R2_BUCKET || 'disabled'
  const accountId = process.env.R2_ACCOUNT_ID || 'disabled'
  const publicBase = r2PublicBaseUrl()

  return s3Storage({
    enabled: configured,
    alwaysInsertFields: true,
    bucket,
    collections: {
      media: {
        prefix: 'tenants',
        ...(publicBase
          ? {
              disablePayloadAccessControl: true,
              generateFileURL: ({ filename, prefix }) => {
                const key = prefix ? `${prefix}/${filename}` : filename
                return `${publicBase}/${key}`
              },
            }
          : {}),
      },
    },
    config: {
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || 'disabled',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'disabled',
      },
    },
  })
}
