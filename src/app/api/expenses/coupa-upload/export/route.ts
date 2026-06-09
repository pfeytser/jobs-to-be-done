import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { get } from '@vercel/blob'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { listCoupaUploadItems } from '@/lib/db/expenses'
import { getReceiptFileById } from '@/lib/db/receipts'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function csvCell(v: string | number | null): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Builds a ZIP of receipt PDFs named report_merchant_amount.ext, plus a manifest.csv
// mapping each file to its Coupa report/line. Optional ?report=NN limits to one report.
// The manifest is the contract the future Playwright upload step will consume.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const reportFilter = req.nextUrl.searchParams.get('report')
    let items = await listCoupaUploadItems()
    if (reportFilter) items = items.filter((i) => i.report_number === reportFilter)
    if (items.length === 0) {
      return NextResponse.json({ error: 'No confirmed receipts to export' }, { status: 404 })
    }

    const zip = new JSZip()
    const manifest: string[] = [
      ['report_number', 'report_name', 'expense_date', 'merchant', 'amount_usd', 'receipt_amount_original', 'filename'].join(','),
    ]
    const usedNames = new Set<string>()

    for (const item of items) {
      const file = await getReceiptFileById(item.receipt_file_id)
      const ref = file?.storage_file_id || file?.storage_url
      if (!file || !ref) continue

      // Ensure unique filename within the archive.
      let name = item.suggested_filename
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf('.')
        let n = 2
        while (usedNames.has(`${name.slice(0, dot)}_${n}${name.slice(dot)}`)) n++
        name = `${name.slice(0, dot)}_${n}${name.slice(dot)}`
      }
      usedNames.add(name)

      try {
        const res = await get(ref, { access: 'private' })
        if (res && res.statusCode === 200 && res.stream) {
          const buf = Buffer.from(await new Response(res.stream).arrayBuffer())
          // Organize into per-report folders for easy drag-and-drop into Coupa.
          zip.file(`${item.report_number || 'no-report'}/${name}`, buf)
        }
      } catch {
        // skip unreadable file
      }

      manifest.push(
        [
          csvCell(item.report_number),
          csvCell(item.report_name),
          csvCell(item.expense_date),
          csvCell(item.merchant),
          csvCell(item.amount_usd),
          csvCell(item.receipt_amount_original),
          csvCell(`${item.report_number || 'no-report'}/${name}`),
        ].join(',')
      )
    }

    zip.file('manifest.csv', manifest.join('\n'))
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

    const fname = reportFilter ? `coupa-receipts-${reportFilter}.zip` : 'coupa-receipts.zip'
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fname}"`,
      },
    })
  } catch (error) {
    console.error('[expenses/coupa-upload/export GET]', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
