import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'crypto'

// Encrypts OAuth refresh tokens at rest with AES-256-GCM. The stored value is
// base64(nonce[12] || ciphertext || tag[16]).
//
// Key resolution: prefer RECEIPT_TOKEN_KEY (base64-encoded 32 bytes). If absent,
// derive a stable 32-byte key from NEXTAUTH_SECRET via HKDF so the app and the
// local worker agree without extra configuration. NEVER log the key or the
// plaintext token.

const IV_LEN = 12
const TAG_LEN = 16

function resolveKey(): Buffer {
  const raw = process.env.RECEIPT_TOKEN_KEY
  if (raw) {
    const key = Buffer.from(raw, 'base64')
    if (key.length !== 32) {
      throw new Error('RECEIPT_TOKEN_KEY must be base64-encoded 32 bytes (256-bit)')
    }
    return key
  }
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      'Cannot encrypt tokens: set RECEIPT_TOKEN_KEY (base64 32 bytes) or NEXTAUTH_SECRET'
    )
  }
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(secret), Buffer.alloc(0), Buffer.from('expense-receipt-tokens'), 32)
  )
}

export function encryptToken(plaintext: string): string {
  const key = resolveKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, enc, tag]).toString('base64')
}

export function decryptToken(payload: string): string {
  const key = resolveKey()
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(buf.length - TAG_LEN)
  const enc = buf.subarray(IV_LEN, buf.length - TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
