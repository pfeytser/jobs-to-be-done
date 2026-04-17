import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { parse } from 'csv-parse/sync'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await params

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userType = (formData.get('user_type') as string | null)?.trim() ?? ''

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const name = file.name.toLowerCase()
    if (!name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      return NextResponse.json({ error: 'Only CSV files are supported. Please export your spreadsheet as CSV and try again.' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds the 5MB limit.' }, { status: 400 })
    }

    const text = Buffer.from(await file.arrayBuffer()).toString('utf-8')

    let rows: Record<string, string>[]
    try {
      rows = parse(text, {
        columns: (headers: string[]) => headers.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[]
    } catch {
      return NextResponse.json({ error: 'Could not parse the CSV file. Make sure it has a header row and is comma-separated.' }, { status: 422 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'The CSV file appears to be empty.' }, { status: 422 })
    }

    const items = rows.map((row, i) => ({
      tc_number: row.tc_number ?? `${i + 1}`,
      part: row.part ?? '',
      section: row.section ?? '',
      feature_area: row.feature_area ?? '',
      platform: row.platform ?? '',
      user_type: userType,
      test_description: row.test_description ?? '',
      steps: '',
      expected_result: row.expected_result ?? '',
      jira_reference: row.jira_reference ?? '',
      needs_review: false,
    }))

    return NextResponse.json({ items, count: items.length })
  } catch (error) {
    console.error('[qa/upload POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const config = {
  api: { bodyParser: false },
}
