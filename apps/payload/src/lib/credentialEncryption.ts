import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

function encryptionKey(): Buffer {
  const raw =
    process.env.CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    process.env.DEPLOY_REPORT_TOKEN?.trim() ||
    process.env.PAYLOAD_SECRET?.trim() ||
    ''
  if (!raw) {
    throw new Error(
      'Set CREDENTIALS_ENCRYPTION_KEY (recommended) or DEPLOY_REPORT_TOKEN / PAYLOAD_SECRET for credential encryption.',
    )
  }
  return createHash('sha256').update(raw, 'utf8').digest()
}

export function encryptSecret(plain: string): string {
  const key = encryptionKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptSecret(blob: string): string {
  const key = encryptionKey()
  const buf = Buffer.from(blob, 'base64')
  if (buf.length < IV_BYTES + 16 + 1) {
    throw new Error('Invalid encrypted credential blob.')
  }
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + 16)
  const data = buf.subarray(IV_BYTES + 16)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
