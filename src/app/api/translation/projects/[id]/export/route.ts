import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { auth } from '@/lib/auth/config'
import { getProject, listDatasets, getDatasetEdits } from '@/lib/db/translation'
import { projectLanguages } from '@/lib/translation/entries'
import { rebuildTargetJson, targetValueMap, flattenStrings } from '@/lib/translation/json'
import { parseCsv, rebuildCsvMultiLang, isTrivialValue } from '@/lib/translation/csv'
import { missingTokens } from '@/lib/translation/placeholders'
import type { UiDatasetConfig, CsvDatasetConfig, TranslationDataset } from '@/lib/translation/types'

export const dynamic = 'force-dynamic'

interface OutFile {
  path: string // zip path / download name
  content: string
  edited: number
  blank: number
  warnings: number
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'export'
}

// Count edited / blank / placeholder-warning strings for a UI target (brief FR-21).
function uiCounts(
  englishText: string,
  original: Map<string, string>,
  edits: Map<string, string>,
): { edited: number; blank: number; warnings: number } {
  let edited = 0,
    blank = 0,
    warnings = 0
  for (const leaf of flattenStrings(JSON.parse(englishText))) {
    const orig = original.get(leaf.path) ?? ''
    const value = edits.has(leaf.path) ? edits.get(leaf.path)! : orig
    if (value !== orig) edited++
    if (value.trim() === '' && leaf.value.trim() !== '') blank++
    if (missingTokens(leaf.value, value).length > 0) warnings++
  }
  return { edited, blank, warnings }
}

async function buildUiFiles(ds: TranslationDataset, langs: string[], fillEnglish: boolean): Promise<OutFile[]> {
  const config = ds.config as UiDatasetConfig
  const out: OutFile[] = []
  for (const lang of langs) {
    const target = config.targets[lang]
    if (!target) continue
    const original = targetValueMap(target.text)
    const edits = await getDatasetEdits(ds.id, lang)
    const content = rebuildTargetJson(ds.english_source, original, edits, fillEnglish)
    const counts = uiCounts(ds.english_source, original, edits)
    out.push({ path: `${sanitize(ds.name)}/${target.fileName}`, content, ...counts })
  }
  return out
}

// Count edited / blank / warning cells for a CSV dataset across the requested langs.
function csvCounts(ds: TranslationDataset, langs: string[], editsByLang: Map<string, Map<string, string>>) {
  const config = ds.config as CsvDatasetConfig
  const parsed = parseCsv(ds.english_source)
  const englishIdx = parsed.headers.indexOf(config.englishColumn)
  let edited = 0,
    blank = 0,
    warnings = 0
  for (const lang of langs) {
    const langIdx = parsed.headers.indexOf(config.langColumns[lang] ?? '')
    if (langIdx < 0) continue
    const edits = editsByLang.get(lang) ?? new Map()
    parsed.rows.forEach((row, i) => {
      const english = row[englishIdx] ?? ''
      if (isTrivialValue(english)) return
      const orig = row[langIdx] ?? ''
      const value = edits.has(String(i)) ? edits.get(String(i))! : orig
      if (value !== orig) edited++
      if (value.trim() === '' && english.trim() !== '') blank++
      if (missingTokens(english, value).length > 0) warnings++
    })
  }
  return { edited, blank, warnings }
}

async function buildCsvFile(ds: TranslationDataset, langs: string[]): Promise<OutFile | null> {
  const config = ds.config as CsvDatasetConfig
  const applicable = langs.filter((l) => config.langColumns[l])
  if (applicable.length === 0) return null
  const parsed = parseCsv(ds.english_source)
  const editsByLang = new Map<string, Map<string, string>>()
  for (const lang of applicable) editsByLang.set(lang, await getDatasetEdits(ds.id, lang))
  const content = rebuildCsvMultiLang(parsed, config, editsByLang)
  const counts = csvCounts(ds, applicable, editsByLang)
  const fileName = config.fileName || `${sanitize(ds.name)}.csv`
  return { path: `${sanitize(ds.name)}/${fileName}`, content, ...counts }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const project = await getProject(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const datasets = await listDatasets(id)
  const allLangs = projectLanguages(datasets)
  const langParam = req.nextUrl.searchParams.get('lang')
  const langs = langParam ? [langParam] : allLangs
  const fillEnglish = req.nextUrl.searchParams.get('fillEnglish') === '1'

  if (langs.length === 0) {
    return NextResponse.json({ error: 'No languages to export.' }, { status: 400 })
  }

  const files: OutFile[] = []
  for (const ds of datasets) {
    if (ds.kind === 'ui') {
      files.push(...(await buildUiFiles(ds, langs, fillEnglish)))
    } else {
      const f = await buildCsvFile(ds, langs)
      if (f) files.push(f)
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: 'Nothing to export for the selected language(s).' }, { status: 400 })
  }

  const summary = {
    files: files.map((f) => ({ name: f.path, edited: f.edited, blank: f.blank, warnings: f.warnings })),
  }
  const summaryHeader = encodeURIComponent(JSON.stringify(summary))

  // A single file downloads directly; multiple files come back as a zip.
  if (files.length === 1) {
    const f = files[0]
    const isJson = f.path.endsWith('.json')
    const downloadName = f.path.split('/').pop() ?? 'export'
    return new NextResponse(f.content, {
      headers: {
        'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'X-Translation-Summary': summaryHeader,
      },
    })
  }

  const zip = new JSZip()
  for (const f of files) zip.file(f.path, f.content)
  const blob = await zip.generateAsync({ type: 'uint8array' })
  const zipName = `${sanitize(project.name)}${langParam ? '-' + sanitize(langParam) : ''}-translations.zip`
  return new NextResponse(blob as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'X-Translation-Summary': summaryHeader,
    },
  })
}
