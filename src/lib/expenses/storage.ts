import { put } from '@vercel/blob'
import { createHash } from 'crypto'

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

export interface StoredBlob {
  storage_url: string
  storage_file_id: string // blob pathname
  sha256_hash: string
  mime_type: string
  file_name: string
}

// Uploads a receipt file to Vercel Blob under expense-receipts/. The pathname embeds
// the content hash so identical files collide harmlessly. Requires BLOB_READ_WRITE_TOKEN.
export async function storeReceiptBlob(
  buf: Buffer,
  fileName: string,
  mimeType: string
): Promise<StoredBlob> {
  const hash = sha256(buf)
  const safeName = fileName.replace(/[^\w.\-]+/g, '_').slice(-80) || 'receipt.pdf'
  const pathname = `expense-receipts/${hash.slice(0, 16)}-${safeName}`
  // The project's Blob store is configured for private access; match it (same as
  // QA screenshots). The returned url is an unguessable capability URL the owner-only
  // detail view links to.
  const blob = await put(pathname, buf, {
    access: 'private',
    contentType: mimeType,
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return {
    storage_url: blob.url,
    storage_file_id: blob.pathname,
    sha256_hash: hash,
    mime_type: mimeType,
    file_name: safeName,
  }
}
