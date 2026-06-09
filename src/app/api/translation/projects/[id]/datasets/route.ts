import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth/config'
import { isTranslationOwner } from '@/lib/translation/access'
import { getProject, createDataset } from '@/lib/db/translation'
import { compareStructure } from '@/lib/translation/json'
import { parseCsv } from '@/lib/translation/csv'
import type { UiDatasetConfig, CsvDatasetConfig } from '@/lib/translation/types'

export const dynamic = 'force-dynamic'

const FileSchema = z.object({ fileName: z.string().min(1), text: z.string() })

const UiSchema = z.object({
  kind: z.literal('ui'),
  name: z.string().trim().max(120).optional(),
  english: FileSchema,
  targets: z.array(FileSchema).min(1),
})

const CsvSchema = z.object({
  kind: z.literal('csv'),
  name: z.string().trim().max(120).optional(),
  fileName: z.string().max(260).optional(),
  text: z.string().min(1),
  config: z.object({
    englishColumn: z.string().min(1),
    langColumns: z.record(z.string(), z.string()),
    labelColumns: z.array(z.string()),
  }),
})

const BodySchema = z.discriminatedUnion('kind', [UiSchema, CsvSchema])

// Strip directory + .json extension to get a locale code from a target filename.
function localeFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName
  return base.replace(/\.json$/i, '')
}

// Owner-only: add a UI (JSON) or CSV (DB export) dataset to a project.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isTranslationOwner(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const project = await getProject(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', detail: parsed.error.issues }, { status: 400 })
  }
  const body = parsed.data

  if (body.kind === 'ui') {
    // Validate JSON parses; report (advisory) structural mismatches per target.
    try {
      JSON.parse(body.english.text)
    } catch {
      return NextResponse.json({ error: `English file ${body.english.fileName} is not valid JSON.` }, { status: 400 })
    }
    const targets: UiDatasetConfig['targets'] = {}
    const mismatches: NonNullable<UiDatasetConfig['mismatches']> = {}
    for (const t of body.targets) {
      try {
        JSON.parse(t.text)
      } catch {
        return NextResponse.json({ error: `Target file ${t.fileName} is not valid JSON.` }, { status: 400 })
      }
      const lang = localeFromFileName(t.fileName)
      targets[lang] = { fileName: t.fileName, text: t.text }
      const cmp = compareStructure(body.english.text, t.text)
      if (cmp.missingInTarget.length || cmp.extraInTarget.length) mismatches[lang] = cmp
    }
    const config: UiDatasetConfig = {
      englishFileName: body.english.fileName,
      targets,
      mismatches: Object.keys(mismatches).length ? mismatches : undefined,
    }
    const dataset = await createDataset(id, 'ui', body.name?.trim() || 'UI dictionary', body.english.text, config)
    return NextResponse.json({ dataset })
  }

  // CSV
  let parsedCsv
  try {
    parsedCsv = parseCsv(body.text)
  } catch {
    return NextResponse.json({ error: 'Could not parse the CSV file.' }, { status: 400 })
  }
  const headers = parsedCsv.headers
  const { englishColumn, langColumns, labelColumns } = body.config
  if (!headers.includes(englishColumn)) {
    return NextResponse.json({ error: 'English column not found in CSV headers.' }, { status: 400 })
  }
  for (const header of Object.values(langColumns)) {
    if (!headers.includes(header)) {
      return NextResponse.json({ error: `Language column "${header}" not found in CSV headers.` }, { status: 400 })
    }
  }
  if (Object.keys(langColumns).length === 0) {
    return NextResponse.json({ error: 'Select at least one language column.' }, { status: 400 })
  }
  const config: CsvDatasetConfig = {
    fileName: body.fileName,
    headers,
    englishColumn,
    langColumns,
    labelColumns: labelColumns.filter((h) => headers.includes(h)),
    eol: parsedCsv.eol,
  }
  const dataset = await createDataset(id, 'csv', body.name?.trim() || 'Database export', body.text, config)
  return NextResponse.json({ dataset })
}
