import { NextRequest, NextResponse } from 'next/server'
import { requireExpenseOwner, route } from '@/lib/auth/guards'
import { prepareCsv, isCsvFile, MAX_BYTES } from '@/lib/expenses/prepare'
import { upsertPreparedRows, type ImportSummary } from '@/lib/db/expenses'

export const POST = route(async (req: NextRequest) => {
  await requireExpenseOwner()

  const formData = await req.formData()
  const files = formData.getAll('files').filter((f): f is File => f instanceof File)

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
  }

  const combined: ImportSummary = {
    rowsProcessed: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    rowsSkipped: 0,
    errors: [],
  }
  const perFile: { fileName: string; error?: string; summary?: ImportSummary }[] = []

  for (const file of files) {
    if (!isCsvFile(file)) {
      perFile.push({ fileName: file.name, error: 'Only CSV files are supported.' })
      continue
    }
    if (file.size > MAX_BYTES) {
      perFile.push({ fileName: file.name, error: 'File exceeds the 5MB limit.' })
      continue
    }

    const text = Buffer.from(await file.arrayBuffer()).toString('utf-8')
    const prepared = prepareCsv(text, file.name)

    if (prepared.parseError) {
      perFile.push({ fileName: file.name, error: prepared.parseError })
      continue
    }

    const summary = await upsertPreparedRows(file.name, prepared.rows)
    perFile.push({ fileName: file.name, summary })

    combined.rowsProcessed += summary.rowsProcessed
    combined.rowsInserted += summary.rowsInserted
    combined.rowsUpdated += summary.rowsUpdated
    combined.rowsSkipped += summary.rowsSkipped
    combined.errors.push(...summary.errors)
  }

  return NextResponse.json({ summary: combined, perFile })
})

export const config = {
  api: { bodyParser: false },
}
