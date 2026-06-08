import { createHash } from 'crypto'

// ── Field definitions ────────────────────────────────────────────────────────
// The canonical DB field names for an expense transaction, sourced from a Coupa
// CSV export. Metadata, match, and timestamp columns are NOT sourced from the
// CSV and are intentionally absent here.

export const TEXT_FIELDS = [
  'report_number',
  'report_name',
  'card_id',
  'expensed_by',
  'category',
  'item_name',
  'merchant',
  'gl_code',
  'account_full',
  'reimburse_to_employee',
  'reason',
  'bill_back',
  'billed_back_to',
] as const

export const NUMBER_FIELDS = [
  'amount_usd',
  'receipt_amount_original',
  'price_per_unit',
  'report_total_usd',
  'report_reimburse_total_usd',
] as const

export const DATE_FIELDS = ['statement_date', 'expense_date', 'arrival_date'] as const

export type TextField = (typeof TEXT_FIELDS)[number]
export type NumberField = (typeof NUMBER_FIELDS)[number]
export type DateField = (typeof DATE_FIELDS)[number]
export type SourceField = TextField | NumberField | DateField

// A fully normalized row ready to be persisted (minus metadata/match/timestamps).
export type NormalizedRow = {
  [K in TextField]: string
} & {
  [K in NumberField]: number | null
} & {
  [K in DateField]: string | null
}

// ── Column aliases ───────────────────────────────────────────────────────────
// Headers are matched case-insensitively after whitespace is collapsed. The first
// alias in each list is the exact Coupa export header; the rest are tolerant
// fallbacks in case the export is tweaked or hand-edited.
const FIELD_ALIASES: Record<SourceField, string[]> = {
  report_number: ['report number', 'report #', 'report no', 'report num'],
  report_name: ['report name'],
  statement_date: ['statement date'],
  card_id: ['card / id', 'card/id', 'card id', 'card'],
  expensed_by: ['expensed by', 'employee'],
  expense_date: ['expense date', 'transaction date', 'date'],
  category: ['category', 'expense category'],
  item_name: ['item name', 'item', 'expense type'],
  merchant: ['merchant', 'vendor', 'supplier', 'payee'],
  amount_usd: ['amount (usd)', 'amount usd', 'amount'],
  receipt_amount_original: [
    'receipt amount (original)',
    'receipt amount original',
    'receipt amount',
    'original amount',
  ],
  gl_code: ['gl code', 'g/l code', 'gl'],
  account_full: ['account (full)', 'account full', 'account'],
  reimburse_to_employee: ['reimburse to employee', 'reimburse to employee?', 'reimbursable'],
  reason: ['reason', 'business reason', 'justification'],
  bill_back: ['bill back?', 'bill back', 'billback'],
  billed_back_to: ['billed back to', 'bill back to'],
  price_per_unit: ['price per unit', 'unit price', 'price/unit'],
  arrival_date: ['arrival date'],
  report_total_usd: ['report total (usd)', 'report total usd', 'report total'],
  report_reimburse_total_usd: [
    'report reimburse total (usd)',
    'report reimburse total usd',
    'report reimburse total',
  ],
}

const ALL_FIELDS: SourceField[] = [...TEXT_FIELDS, ...NUMBER_FIELDS, ...DATE_FIELDS]

export const REQUIRED_FIELDS: SourceField[] = [
  'report_number',
  'expense_date',
  'merchant',
  'amount_usd',
]

// Human labels for surfacing validation/preview messages.
export const FIELD_LABELS: Record<SourceField, string> = {
  report_number: 'Report Number',
  report_name: 'Report Name',
  statement_date: 'Statement Date',
  card_id: 'Card / ID',
  expensed_by: 'Expensed By',
  expense_date: 'Expense Date',
  category: 'Category',
  item_name: 'Item Name',
  merchant: 'Merchant',
  amount_usd: 'Amount (USD)',
  receipt_amount_original: 'Receipt Amount (Original)',
  gl_code: 'GL Code',
  account_full: 'Account (Full)',
  reimburse_to_employee: 'Reimburse to Employee',
  reason: 'Reason',
  bill_back: 'Bill Back?',
  billed_back_to: 'Billed Back To',
  price_per_unit: 'Price per Unit',
  arrival_date: 'Arrival Date',
  report_total_usd: 'Report Total (USD)',
  report_reimburse_total_usd: 'Report Reimburse Total (USD)',
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Maps each known field to the original (case-preserved) header it was found under,
// or null if the column is absent. Earlier fields claim headers first so that a
// generic alias (e.g. "amount") can't steal a column a more specific field needs.
export function resolveColumns(headers: string[]): {
  mapping: Record<SourceField, string | null>
  unmapped: string[]
} {
  const normalized = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }))
  const used = new Set<string>()
  const mapping = {} as Record<SourceField, string | null>

  for (const field of ALL_FIELDS) {
    let found: string | null = null
    for (const alias of FIELD_ALIASES[field]) {
      const match = normalized.find((h) => h.norm === alias && !used.has(h.original))
      if (match) {
        found = match.original
        used.add(match.original)
        break
      }
    }
    mapping[field] = found
  }

  const unmapped = headers.filter((h) => !used.has(h))
  return { mapping, unmapped }
}

// ── Value normalization ──────────────────────────────────────────────────────

// Parses a money/number string into a number. Strips currency symbols, codes,
// thousands separators, and whitespace; treats parenthesized values as negative.
// Returns null when there is no parseable numeric content.
export function parseAmount(raw: string | undefined | null): number | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null
  const negative = /^\(.*\)$/.test(s) || s.includes('-')
  s = s.replace(/[(),]/g, '').replace(/[^0-9.]/g, '')
  if (!s || s === '.') return null
  const n = parseFloat(s)
  if (Number.isNaN(n)) return null
  return negative ? -Math.abs(n) : n
}

// Normalizes a date string to ISO `YYYY-MM-DD` for reliable range filtering and
// lexicographic sorting. Handles M/D/YYYY, YYYY-MM-DD, and common Date-parseable
// forms. Falls back to the trimmed original string when it can't be parsed, so no
// information is lost.
export function parseDate(raw: string | undefined | null): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  // Already ISO (optionally with a time component)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // M/D/YYYY or MM/DD/YYYY (also accepts '-' separators)
  const us = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (us) {
    let [, mm, dd, yyyy] = us
    if (yyyy.length === 2) yyyy = `20${yyyy}`
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  // Fallback: let the runtime try (e.g. "Jan 5, 2026"). Use UTC to avoid TZ drift.
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return s
}

function rawValue(row: Record<string, string>, header: string | null): string {
  if (!header) return ''
  return (row[header] ?? '').trim()
}

// Turns one raw CSV row into a fully normalized row using the resolved mapping.
export function normalizeRow(
  row: Record<string, string>,
  mapping: Record<SourceField, string | null>
): NormalizedRow {
  const out = {} as NormalizedRow
  for (const field of TEXT_FIELDS) {
    out[field] = rawValue(row, mapping[field])
  }
  for (const field of NUMBER_FIELDS) {
    out[field] = parseAmount(rawValue(row, mapping[field]))
  }
  for (const field of DATE_FIELDS) {
    out[field] = parseDate(rawValue(row, mapping[field]))
  }
  return out
}

// ── Deterministic row hash ───────────────────────────────────────────────────
// Coupa exports carry no unique transaction id, and legitimately-distinct line
// items can be byte-for-byte identical (e.g. ten identical refund reversals on the
// same day). So the hash has two parts:
//   1. A content hash over the key identity fields + every normalized field value.
//   2. An occurrence ordinal distinguishing the Nth identical-content row within a
//      single file.
// This preserves genuine duplicates on first import while keeping a re-import of the
// same file idempotent (same rows in the same order → same hashes → updates, not
// duplicates). See computeRowHash() in prepare.ts for how the ordinal is applied.
export function computeContentHash(n: NormalizedRow): string {
  const ordered: Record<string, unknown> = {}
  for (const field of [...ALL_FIELDS].sort()) {
    ordered[field] = (n as Record<string, unknown>)[field]
  }
  const key = [
    n.report_number,
    n.expense_date ?? '',
    n.merchant.toLowerCase(),
    n.amount_usd ?? '',
    n.receipt_amount_original ?? '',
    n.card_id,
    JSON.stringify(ordered),
  ].join('|')
  return createHash('sha256').update(key).digest('hex')
}

// Folds the within-file occurrence ordinal into the content hash to produce the
// final, storable source_row_hash. occurrence is 0-based.
export function withOccurrence(contentHash: string, occurrence: number): string {
  if (occurrence === 0) return createHash('sha256').update(`${contentHash}#0`).digest('hex')
  return createHash('sha256').update(`${contentHash}#${occurrence}`).digest('hex')
}

// Validates a raw row against required fields. Returns a list of human-readable
// problems; an empty list means the row is importable.
export function validateRow(
  n: NormalizedRow,
  raw: Record<string, string>,
  mapping: Record<SourceField, string | null>
): string[] {
  const errors: string[] = []
  for (const field of REQUIRED_FIELDS) {
    if (!mapping[field]) {
      // Missing column entirely — reported once at the file level too, but flag here
      // so the row is skipped rather than silently importing blanks.
      errors.push(`Missing required column "${FIELD_LABELS[field]}"`)
      continue
    }
    if (field === 'amount_usd') {
      if (n.amount_usd == null) errors.push(`"${FIELD_LABELS[field]}" is empty or not a number`)
    } else if (field === 'expense_date') {
      if (!n.expense_date) errors.push(`"${FIELD_LABELS[field]}" is empty`)
    } else {
      const v = (n as Record<string, unknown>)[field]
      if (!v || String(v).trim() === '') errors.push(`"${FIELD_LABELS[field]}" is empty`)
    }
  }
  void raw
  return errors
}
