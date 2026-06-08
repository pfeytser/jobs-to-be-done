import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { getExpenseById, setExpenseMatchState } from '@/lib/db/expenses'
import { createReceiptFile, upsertReceiptMatch } from '@/lib/db/receipts'
import { storeReceiptBlob, sha256 } from '@/lib/expenses/storage'

const MAX_BYTES = 15 * 1024 * 1024

// Manual receipt upload → store in Blob → receipt_files (manual_upload) →
// approved receipt_match → expense matched.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { id } = await params
    const expense = await getExpenseById(id)
    if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 15MB limit.' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const mime = file.type || 'application/pdf'
    const stored = await storeReceiptBlob(bytes, file.name || 'receipt', mime)

    const receipt = await createReceiptFile({
      source_type: 'manual_upload',
      storage_url: stored.storage_url,
      storage_file_id: stored.storage_file_id,
      file_name: stored.file_name,
      mime_type: mime,
      sha256_hash: sha256(bytes),
    })

    const matchId = await upsertReceiptMatch({
      expense_transaction_id: id,
      receipt_file_id: receipt.id,
      confidence_score: 100,
      match_method: 'manual_upload',
      match_status: 'approved',
      matched_amount_type: 'unknown',
      matched_amount_value: null,
      matched_email_account_id: null,
      reason_summary: 'Manually uploaded receipt',
    })

    await setExpenseMatchState(id, {
      match_status: 'matched',
      matched_receipt_file_id: receipt.id,
      confidence_score: 100,
    })

    return NextResponse.json({ ok: true, matchId, receiptId: receipt.id })
  } catch (error) {
    console.error('[expenses/:id/receipt POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const config = { api: { bodyParser: false } }
