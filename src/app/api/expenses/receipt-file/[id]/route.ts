import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { getReceiptFileById } from '@/lib/db/receipts'

// Owner-gated proxy for private receipt blobs. The Blob store is private, so its
// URLs 403 on anonymous fetch — we stream the bytes server-side using the store
// token instead. Linked from the expense detail view.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { id } = await params
    const file = await getReceiptFileById(id)
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const ref = file.storage_file_id || file.storage_url
    if (!ref) return NextResponse.json({ error: 'No stored file' }, { status: 404 })

    const result = await get(ref, { access: 'private' })
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
    }

    const filename = (file.file_name || 'receipt').replace(/"/g, '')
    return new Response(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || file.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error('[expenses/receipt-file GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
