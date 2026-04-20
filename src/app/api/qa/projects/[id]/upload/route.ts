import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { parse } from 'csv-parse/sync'

// Fuzzy column aliases — order matters (most specific first)
const COLUMN_ALIASES: Record<string, string[]> = {
  tc_number: [
    'tc_number', 'tc number', 'tc#', 'tc #', 'test case number', 'test_case_number',
    'test case no', 'case number', 'case no', 'no', 'number', 'id', '#',
  ],
  part: [
    'part', 'part name', 'part_name', 'category', 'chapter', 'group',
  ],
  section: [
    'section', 'section name', 'section_name', 'subsection', 'sub section',
  ],
  feature_area: [
    'feature_area', 'feature area', 'feature', 'area', 'module', 'component',
    'functionality', 'sub feature', 'sub_feature',
  ],
  platform: [
    'platform', 'platforms', 'type', 'device type', 'app type', 'app', 'channel',
  ],
  viewport: [
    'viewport', 'viewports', 'view port', 'screen size', 'screen', 'breakpoint',
    'device', 'display',
  ],
  test_description: [
    'test_description', 'test description', 'description', 'test', 'scenario',
    'test scenario', 'what to test', 'test case', 'steps to test', 'instructions',
    'test steps', 'testing steps',
  ],
  expected_result: [
    'expected_result', 'expected result', 'expected results', 'expected outcome',
    'expected', 'result', 'pass criteria', 'acceptance criteria', 'expected behavior',
    'expected behaviour',
  ],
  jira_reference: [
    'jira_reference', 'jira reference', 'jira', 'jira ticket', 'ticket',
    'issue', 'reference', 'ticket ref', 'jira ref', 'ticket number', 'jira id',
  ],
}

function resolveColumns(headers: string[]): {
  mapping: Record<string, string | null>
  unmapped: string[]
} {
  const mapping: Record<string, string | null> = {}
  const usedHeaders = new Set<string>()

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    let found: string | null = null
    for (const alias of aliases) {
      const match = headers.find((h) => h === alias && !usedHeaders.has(h))
      if (match) {
        found = match
        usedHeaders.add(match)
        break
      }
    }
    mapping[field] = found
  }

  const unmapped = headers.filter((h) => !usedHeaders.has(h))
  return { mapping, unmapped }
}

function validate(
  items: ReturnType<typeof buildItems>,
  mapping: Record<string, string | null>
): { warnings: string[]; info: string[] } {
  const warnings: string[] = []
  const info: string[] = []

  // Critical: test_description
  if (!mapping.test_description) {
    warnings.push(
      'No "test_description" column found — testers won\'t see what to test. ' +
      'Expected column names: test_description, description, scenario, test.'
    )
  } else {
    const empty = items.filter((i) => !i.test_description.trim()).length
    if (empty > 0) {
      warnings.push(`${empty} item${empty > 1 ? 's have' : ' has'} an empty test description — ${empty > 1 ? 'they' : 'it'} will appear blank to testers.`)
    }
  }

  // Platform: affects viewport filtering
  if (!mapping.platform) {
    warnings.push(
      'No "platform" column found — all items will show for every session type (Desktop and Mobile). ' +
      'Add a platform column with values like "Web" or "Mobile App" for proper filtering.'
    )
  } else {
    const empty = items.filter((i) => !i.platform.trim()).length
    if (empty > 0) {
      warnings.push(`${empty} item${empty > 1 ? 's have' : ' has'} no platform value — ${empty > 1 ? 'they' : 'it'} will appear in all sessions.`)
    }
  }

  // Viewport: affects Desktop vs Mobile filtering
  if (!mapping.viewport) {
    info.push(
      'No "viewport" column found — items will appear for all viewport sizes. ' +
      'Add a viewport column (e.g., "Desktop", "Mobile & Desktop") to filter by session type.'
    )
  } else {
    const empty = items.filter(
      (i) => !i.viewport.trim() && i.platform.toLowerCase() !== 'mobile app'
    ).length
    if (empty > 0) {
      info.push(`${empty} Web item${empty > 1 ? 's have' : ' has'} no viewport value — ${empty > 1 ? 'they' : 'it'} will show in all sessions.`)
    }
  }

  // Expected result
  if (!mapping.expected_result) {
    info.push(
      'No "expected_result" column found — testers won\'t see what outcome to look for.'
    )
  }

  // Desktop vs Mobile breakdown
  const desktopCount = items.filter(
    (i) => i.platform.toLowerCase() !== 'mobile app' &&
      (i.viewport === '' || i.viewport.toLowerCase().includes('desktop'))
  ).length
  const mobileCount = items.filter(
    (i) => i.platform.toLowerCase() === 'mobile app' ||
      i.viewport.toLowerCase().includes('mobile')
  ).length
  if (desktopCount > 0 || mobileCount > 0) {
    info.push(
      `Session visibility: ~${desktopCount} item${desktopCount !== 1 ? 's' : ''} will show for Desktop sessions, ~${mobileCount} for Mobile sessions.`
    )
  }

  return { warnings, info }
}

function buildItems(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  userType: string
) {
  return rows.map((row, i) => {
    const get = (field: string) => {
      const col = mapping[field]
      return col ? (row[col] ?? '').trim() : ''
    }
    return {
      tc_number: get('tc_number') || String(i + 1),
      part: get('part'),
      section: get('section'),
      feature_area: get('feature_area'),
      platform: get('platform'),
      viewport: get('viewport'),
      user_type: userType,
      test_description: get('test_description'),
      steps: '',
      expected_result: get('expected_result'),
      jira_reference: get('jira_reference'),
      needs_review: false,
    }
  })
}

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
      return NextResponse.json({
        error: 'Only CSV files are supported. Please export your spreadsheet as CSV and try again.',
      }, { status: 400 })
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
      return NextResponse.json({
        error: 'Could not parse the CSV file. Make sure it has a header row and is comma-separated.',
      }, { status: 422 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'The CSV file appears to be empty.' }, { status: 422 })
    }

    const headers = Object.keys(rows[0])
    const { mapping, unmapped } = resolveColumns(headers)
    const items = buildItems(rows, mapping, userType)

    if (!items.length) {
      return NextResponse.json({
        error: 'No test items found in this CSV. Check that the file has a header row with recognizable columns.',
      }, { status: 422 })
    }

    const { warnings, info } = validate(items, mapping)

    // Include which CSV columns were recognised
    const recognisedColumns = Object.entries(mapping)
      .filter(([, v]) => v !== null)
      .map(([field, col]) => ({ field, column: col as string }))

    return NextResponse.json({
      items,
      count: items.length,
      validation: { warnings, info, recognisedColumns, unmappedColumns: unmapped },
    })
  } catch (error) {
    console.error('[qa/upload POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const config = {
  api: { bodyParser: false },
}
