// Database-export CSV handling (brief §8.2).
//
// We parse to a raw matrix (header row + data rows as string[][]) so we can rewrite
// only the cells in the edited language column and re-serialize everything else
// stably. All id/path/metadata columns and other language columns are untouched.

import { parse } from 'csv-parse/sync'
import type { CsvDatasetConfig } from './types'

export interface ParsedCsv {
  headers: string[]
  rows: string[][] // data rows only (header excluded)
  eol: '\r\n' | '\n'
}

export function parseCsv(text: string): ParsedCsv {
  const matrix = parse(text, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][]
  const eol: '\r\n' | '\n' = text.includes('\r\n') ? '\r\n' : '\n'
  if (matrix.length === 0) return { headers: [], rows: [], eol }
  const [headers, ...rows] = matrix
  return { headers: headers.map((h) => h.trim()), rows, eol }
}

const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/
const META_HINT = /\b(id|path|key|slug|url|uri|name|type|page|route|location|alt|field)\b/i

// FR-6: auto-detect the English column and candidate language columns from headers.
// Returns a best-guess config the user confirms/adjusts before the dataset is added.
export function detectColumns(headers: string[], eol: '\r\n' | '\n'): CsvDatasetConfig {
  const trimmed = headers.map((h) => h.trim())
  const englishIdx = trimmed.findIndex((h) => /english|^en(-|$)/i.test(h))
  const englishColumn = englishIdx >= 0 ? trimmed[englishIdx] : trimmed[0] ?? ''

  const langColumns: Record<string, string> = {}
  const labelColumns: string[] = []
  for (const h of trimmed) {
    if (h === englishColumn) continue
    const looksLocale = LOCALE_RE.test(h) && !/^en$/i.test(h)
    if (looksLocale) {
      langColumns[h] = h
    } else if (META_HINT.test(h) || labelColumns.length < 2) {
      // id/path/meta columns make good row labels; otherwise take the first couple.
      labelColumns.push(h)
    }
  }
  // Guarantee at least one label column so rows are identifiable.
  if (labelColumns.length === 0 && trimmed.length > 0) {
    const firstNonLang = trimmed.find((h) => h !== englishColumn && !(h in langColumns))
    if (firstNonLang) labelColumns.push(firstNonLang)
  }
  return { headers: trimmed, englishColumn, langColumns, labelColumns, eol }
}

function quoteField(field: string): string {
  if (/[",\r\n]/.test(field)) return '"' + field.replace(/"/g, '""') + '"'
  return field
}

// Serialize a matrix (header + data rows) with RFC-4180 quoting and the given EOL.
export function serializeCsv(headers: string[], rows: string[][], eol: '\r\n' | '\n'): string {
  const lines = [headers, ...rows].map((row) => row.map(quoteField).join(','))
  // Trailing EOL matches typical CSV exports and keeps diffs clean.
  return lines.join(eol) + eol
}

// Rebuild the CSV with only the chosen language column's cells changed (brief §8.2).
// `edits` maps row index (as string) -> new value. Every other cell is byte-stable.
export function rebuildCsv(
  parsed: ParsedCsv,
  config: CsvDatasetConfig,
  lang: string,
  edits: Map<string, string>,
): string {
  const header = config.langColumns[lang]
  const colIdx = parsed.headers.indexOf(header)
  if (colIdx < 0) return serializeCsv(parsed.headers, parsed.rows, parsed.eol)
  const rows = parsed.rows.map((row, i) => {
    const edit = edits.get(String(i))
    if (edit === undefined) return row
    const next = row.slice()
    // Pad short rows so the target cell exists (relax_column_count can yield gaps).
    while (next.length <= colIdx) next.push('')
    next[colIdx] = edit
    return next
  })
  return serializeCsv(parsed.headers, rows, parsed.eol)
}

// Rebuild applying several language columns at once (brief FR-18 "export all").
// `editsByLang` maps a locale -> (row index string -> new value). Columns without
// edits — and every metadata/id column — stay byte-stable.
export function rebuildCsvMultiLang(
  parsed: ParsedCsv,
  config: CsvDatasetConfig,
  editsByLang: Map<string, Map<string, string>>,
): string {
  const colByLang = new Map<number, Map<string, string>>()
  for (const [lang, edits] of editsByLang) {
    const colIdx = parsed.headers.indexOf(config.langColumns[lang] ?? '')
    if (colIdx >= 0) colByLang.set(colIdx, edits)
  }
  if (colByLang.size === 0) return serializeCsv(parsed.headers, parsed.rows, parsed.eol)
  const rows = parsed.rows.map((row, i) => {
    let next = row
    for (const [colIdx, edits] of colByLang) {
      const edit = edits.get(String(i))
      if (edit === undefined) continue
      if (next === row) next = row.slice()
      while (next.length <= colIdx) next.push('')
      next[colIdx] = edit
    }
    return next
  })
  return serializeCsv(parsed.headers, rows, parsed.eol)
}

// §10: trivial source values (just punctuation, a slash, or a bare number) aren't
// translatable and are excluded from the editable list / exported unchanged.
export function isTrivialValue(v: string): boolean {
  const t = v.trim()
  if (t === '') return true
  if (/^[\d.,%$/\\\-+:#@()[\]{}*&^~`|<>='"\s]+$/.test(t)) return true
  return false
}
