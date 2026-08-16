import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { requireExpenseOwner, route } from '@/lib/auth/guards'
import { getReceiptFileById } from '@/lib/db/receipts'

// Owner-gated proxy for private receipt blobs. The Blob store is private, so its
// URLs 403 on anonymous fetch — we stream the bytes server-side using the store
// token instead. Linked from the expense detail view.
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireExpenseOwner()

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
})
