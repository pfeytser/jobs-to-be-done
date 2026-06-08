import { parse } from 'csv-parse/sync'
import {
  resolveColumns,
  normalizeRow,
  computeContentHash,
  withOccurrence,
  validateRow,
  REQUIRED_FIELDS,
  FIELD_LABELS,
  type NormalizedRow,
  type SourceField,
} from './columns'

export interface PreparedRow {
  rowNumber: number // 1-based data row index within the file
  normalized: NormalizedRow
  hash: string
  raw: Record<string, string>
  errors: string[]
}

export interface PreparedFile {
  fileName: string
  headers: string[]
  mapping: Record<SourceField, string | null>
  unmapped: string[]
  missingRequiredColumns: SourceField[]
  rows: PreparedRow[]
  parseError: string | null
}

const MAX_BYTES = 5 * 1024 * 1024

export function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.csv') ||
    file.type === 'text/csv' ||
    file.type === 'application/vnd.ms-excel'
  )
}

// Parses and normalizes a single CSV file into prepared rows. Pure with respect to
// the database — used identically by the preview and import endpoints so the hashes
// and validation a user sees in the preview are exactly what the import acts on.
export function prepareCsv(text: string, fileName: string): PreparedFile {
  let rows: Record<string, string>[]
  try {
    rows = parse(text, {
      columns: (headers: string[]) => headers.map((h) => h.trim()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, string>[]
  } catch {
    return {
      fileName,
      headers: [],
      mapping: {} as Record<SourceField, string | null>,
      unmapped: [],
      missingRequiredColumns: [],
      rows: [],
      parseError:
        'Could not parse the CSV file. Make sure it has a header row and is comma-separated.',
    }
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const { mapping, unmapped } = resolveColumns(headers)
  const missingRequiredColumns = REQUIRED_FIELDS.filter((f) => !mapping[f])

  // Track how many times each content hash has been seen so identical rows within
  // this file get distinct, deterministic hashes (occurrence 0, 1, 2, …).
  const occurrences = new Map<string, number>()
  const prepared: PreparedRow[] = rows.map((raw, i) => {
    const normalized = normalizeRow(raw, mapping)
    const contentHash = computeContentHash(normalized)
    const occurrence = occurrences.get(contentHash) ?? 0
    occurrences.set(contentHash, occurrence + 1)
    return {
      rowNumber: i + 1,
      normalized,
      hash: withOccurrence(contentHash, occurrence),
      raw,
      errors: validateRow(normalized, raw, mapping),
    }
  })

  return {
    fileName,
    headers,
    mapping,
    unmapped,
    missingRequiredColumns,
    rows: prepared,
    parseError: null,
  }
}

export { MAX_BYTES, FIELD_LABELS }
