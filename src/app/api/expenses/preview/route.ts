import { NextRequest, NextResponse } from 'next/server'
import { requireExpenseOwner, route } from '@/lib/auth/guards'
import { prepareCsv, isCsvFile, MAX_BYTES } from '@/lib/expenses/prepare'
import { FIELD_LABELS, type SourceField } from '@/lib/expenses/columns'

const PREVIEW_LIMIT = 50

export const POST = route(async (req: NextRequest) => {
  await requireExpenseOwner()

  const formData = await req.formData()
  try {
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    const results = []
    for (const file of files) {
      if (!isCsvFile(file)) {
        results.push({
          fileName: file.name,
          error: 'Only CSV files are supported. Export your Coupa report as CSV and try again.',
        })
        continue
      }
      if (file.size > MAX_BYTES) {
        results.push({ fileName: file.name, error: 'File exceeds the 5MB limit.' })
        continue
      }

      const text = Buffer.from(await file.arrayBuffer()).toString('utf-8')
      const prepared = prepareCsv(text, file.name)

      if (prepared.parseError) {
        results.push({ fileName: file.name, error: prepared.parseError })
        continue
      }

      const validRows = prepared.rows.filter((r) => r.errors.length === 0)
      const errorRows = prepared.rows.filter((r) => r.errors.length > 0)

      const recognisedColumns = (Object.entries(prepared.mapping) as [SourceField, string | null][])
        .filter(([, col]) => col !== null)
        .map(([field, col]) => ({ field, label: FIELD_LABELS[field], column: col as string }))

      results.push({
        fileName: file.name,
        totalRows: prepared.rows.length,
        validRows: validRows.length,
        errorRows: errorRows.length,
        missingRequiredColumns: prepared.missingRequiredColumns.map((f) => FIELD_LABELS[f]),
        recognisedColumns,
        unmappedColumns: prepared.unmapped,
        sample: prepared.rows.slice(0, PREVIEW_LIMIT).map((r) => ({
          rowNumber: r.rowNumber,
          expense_date: r.normalized.expense_date,
          merchant: r.normalized.merchant,
          category: r.normalized.category,
          amount_usd: r.normalized.amount_usd,
          receipt_amount_original: r.normalized.receipt_amount_original,
          report_name: r.normalized.report_name,
          report_number: r.normalized.report_number,
          errors: r.errors,
        })),
        sampleTruncated: prepared.rows.length > PREVIEW_LIMIT,
      })
    }

    return NextResponse.json({ files: results })
  } catch (error) {
    console.error('[expenses/preview POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const config = {
  api: { bodyParser: false },
}
