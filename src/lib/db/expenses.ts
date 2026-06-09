import { turso } from './client'
import { runMigrations } from './migrations'
import type { PreparedRow } from '@/lib/expenses/prepare'

export const MATCH_STATUSES = [
  'unmatched',
  'matched',
  'possible_match',
  'needs_review',
  'no_receipt_required',
  'ignored',
] as const

export type MatchStatus = (typeof MATCH_STATUSES)[number]

export interface ExpenseTransaction {
  id: string
  report_number: string
  report_name: string
  statement_date: string | null
  card_id: string
  expensed_by: string
  expense_date: string | null
  category: string
  item_name: string
  merchant: string
  amount_usd: number | null
  receipt_amount_original: number | null
  gl_code: string
  account_full: string
  reimburse_to_employee: string
  reason: string
  bill_back: string
  billed_back_to: string
  price_per_unit: number | null
  arrival_date: string | null
  report_total_usd: number | null
  report_reimburse_total_usd: number | null
  source_file_name: string
  source_row_hash: string
  raw_row_json: string
  match_status: MatchStatus
  matched_receipt_file_id: string | null
  confidence_score: number | null
  last_searched_at: string | null
  created_at: string
  updated_at: string
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

function parseRow(row: Record<string, unknown>): ExpenseTransaction {
  return {
    id: row.id as string,
    report_number: str(row.report_number),
    report_name: str(row.report_name),
    statement_date: (row.statement_date as string) ?? null,
    card_id: str(row.card_id),
    expensed_by: str(row.expensed_by),
    expense_date: (row.expense_date as string) ?? null,
    category: str(row.category),
    item_name: str(row.item_name),
    merchant: str(row.merchant),
    amount_usd: num(row.amount_usd),
    receipt_amount_original: num(row.receipt_amount_original),
    gl_code: str(row.gl_code),
    account_full: str(row.account_full),
    reimburse_to_employee: str(row.reimburse_to_employee),
    reason: str(row.reason),
    bill_back: str(row.bill_back),
    billed_back_to: str(row.billed_back_to),
    price_per_unit: num(row.price_per_unit),
    arrival_date: (row.arrival_date as string) ?? null,
    report_total_usd: num(row.report_total_usd),
    report_reimburse_total_usd: num(row.report_reimburse_total_usd),
    source_file_name: str(row.source_file_name),
    source_row_hash: str(row.source_row_hash),
    raw_row_json: str(row.raw_row_json),
    match_status: (row.match_status as MatchStatus) ?? 'unmatched',
    matched_receipt_file_id: (row.matched_receipt_file_id as string) ?? null,
    confidence_score: num(row.confidence_score),
    last_searched_at: (row.last_searched_at as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

// ── Listing, filtering, sorting ──────────────────────────────────────────────

export interface ExpenseFilters {
  match_status?: string
  expense_date_from?: string
  expense_date_to?: string
  statement_date_from?: string
  statement_date_to?: string
  merchant?: string
  category?: string
  report_name?: string
  reimburse_to_employee?: string
  source_file_name?: string
}

const SORTABLE: Record<string, string> = {
  expense_date: 'expense_date',
  statement_date: 'statement_date',
  merchant: 'merchant',
  amount_usd: 'amount_usd',
  receipt_amount_original: 'receipt_amount_original',
}

export async function listExpenses(
  filters: ExpenseFilters = {},
  sortBy = 'expense_date',
  sortDir: 'asc' | 'desc' = 'desc'
): Promise<ExpenseTransaction[]> {
  await runMigrations()

  const where: string[] = []
  const args: (string | number)[] = []

  if (filters.match_status) {
    where.push('match_status = ?')
    args.push(filters.match_status)
  }
  if (filters.expense_date_from) {
    where.push('expense_date >= ?')
    args.push(filters.expense_date_from)
  }
  if (filters.expense_date_to) {
    where.push('expense_date <= ?')
    args.push(filters.expense_date_to)
  }
  if (filters.statement_date_from) {
    where.push('statement_date >= ?')
    args.push(filters.statement_date_from)
  }
  if (filters.statement_date_to) {
    where.push('statement_date <= ?')
    args.push(filters.statement_date_to)
  }
  if (filters.merchant) {
    where.push('merchant LIKE ?')
    args.push(`%${filters.merchant}%`)
  }
  if (filters.category) {
    where.push('category = ?')
    args.push(filters.category)
  }
  if (filters.report_name) {
    where.push('report_name LIKE ?')
    args.push(`%${filters.report_name}%`)
  }
  if (filters.reimburse_to_employee) {
    where.push('reimburse_to_employee = ?')
    args.push(filters.reimburse_to_employee)
  }
  if (filters.source_file_name) {
    where.push('source_file_name = ?')
    args.push(filters.source_file_name)
  }

  const col = SORTABLE[sortBy] ?? 'expense_date'
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC'
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const result = await turso.execute({
    sql: `SELECT * FROM expense_transactions ${whereSql} ORDER BY ${col} ${dir}, created_at DESC`,
    args,
  })
  return result.rows.map((r) => parseRow(r as Record<string, unknown>))
}

export interface ExpenseFilterOptions {
  match_statuses: string[]
  merchants: string[]
  categories: string[]
  report_names: string[]
  reimburse_to_employee: string[]
  source_file_names: string[]
}

async function distinctValues(column: string): Promise<string[]> {
  const result = await turso.execute(
    `SELECT DISTINCT ${column} AS v FROM expense_transactions WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column} ASC`
  )
  return result.rows.map((r) => String((r as Record<string, unknown>).v))
}

export async function getFilterOptions(): Promise<ExpenseFilterOptions> {
  await runMigrations()
  const [match_statuses, merchants, categories, report_names, reimburse, sourceFiles] =
    await Promise.all([
      distinctValues('match_status'),
      distinctValues('merchant'),
      distinctValues('category'),
      distinctValues('report_name'),
      distinctValues('reimburse_to_employee'),
      distinctValues('source_file_name'),
    ])
  return {
    match_statuses,
    merchants,
    categories,
    report_names,
    reimburse_to_employee: reimburse,
    source_file_names: sourceFiles,
  }
}

// ── Upsert (import) ──────────────────────────────────────────────────────────

export interface ImportSummary {
  rowsProcessed: number
  rowsInserted: number
  rowsUpdated: number
  rowsSkipped: number
  errors: { file: string; row: number; messages: string[] }[]
}

// Generates a unique id for a new transaction row (matches the app's id style).
function newId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// Upserts a batch of prepared rows from one file. Rows with validation errors are
// skipped. Existing rows (matched by source_row_hash) are updated in place while
// preserving any receipt-matching fields a user may have set. Hashes are already
// occurrence-disambiguated per file (see prepare.ts), so legitimately-identical
// line items each get their own row; the in-batch guard below is just a safety net.
export async function upsertPreparedRows(
  fileName: string,
  rows: PreparedRow[]
): Promise<ImportSummary> {
  await runMigrations()

  const summary: ImportSummary = {
    rowsProcessed: rows.length,
    rowsInserted: 0,
    rowsUpdated: 0,
    rowsSkipped: 0,
    errors: [],
  }

  const seenInBatch = new Set<string>()
  const now = new Date().toISOString()

  for (const row of rows) {
    if (row.errors.length > 0) {
      summary.rowsSkipped++
      summary.errors.push({ file: fileName, row: row.rowNumber, messages: row.errors })
      continue
    }
    if (seenInBatch.has(row.hash)) {
      // Same logical row appeared twice in this file — count once.
      summary.rowsSkipped++
      continue
    }
    seenInBatch.add(row.hash)

    const n = row.normalized
    const existing = await turso.execute({
      sql: 'SELECT id FROM expense_transactions WHERE source_row_hash = ?',
      args: [row.hash],
    })

    const rawJson = JSON.stringify(row.raw)

    if (existing.rows.length > 0) {
      // Update data fields; preserve match_status / matched_receipt_file_id /
      // confidence_score / created_at.
      await turso.execute({
        sql: `UPDATE expense_transactions SET
          report_number = ?, report_name = ?, statement_date = ?, card_id = ?,
          expensed_by = ?, expense_date = ?, category = ?, item_name = ?, merchant = ?,
          amount_usd = ?, receipt_amount_original = ?, gl_code = ?, account_full = ?,
          reimburse_to_employee = ?, reason = ?, bill_back = ?, billed_back_to = ?,
          price_per_unit = ?, arrival_date = ?, report_total_usd = ?,
          report_reimburse_total_usd = ?, source_file_name = ?, raw_row_json = ?,
          updated_at = ?
          WHERE source_row_hash = ?`,
        args: [
          n.report_number, n.report_name, n.statement_date, n.card_id,
          n.expensed_by, n.expense_date, n.category, n.item_name, n.merchant,
          n.amount_usd, n.receipt_amount_original, n.gl_code, n.account_full,
          n.reimburse_to_employee, n.reason, n.bill_back, n.billed_back_to,
          n.price_per_unit, n.arrival_date, n.report_total_usd,
          n.report_reimburse_total_usd, fileName, rawJson,
          now, row.hash,
        ],
      })
      summary.rowsUpdated++
    } else {
      await turso.execute({
        sql: `INSERT INTO expense_transactions (
          id, report_number, report_name, statement_date, card_id, expensed_by,
          expense_date, category, item_name, merchant, amount_usd,
          receipt_amount_original, gl_code, account_full, reimburse_to_employee,
          reason, bill_back, billed_back_to, price_per_unit, arrival_date,
          report_total_usd, report_reimburse_total_usd, source_file_name,
          source_row_hash, raw_row_json, match_status, matched_receipt_file_id,
          confidence_score, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unmatched', NULL, NULL, ?, ?)`,
        args: [
          newId(), n.report_number, n.report_name, n.statement_date, n.card_id, n.expensed_by,
          n.expense_date, n.category, n.item_name, n.merchant, n.amount_usd,
          n.receipt_amount_original, n.gl_code, n.account_full, n.reimburse_to_employee,
          n.reason, n.bill_back, n.billed_back_to, n.price_per_unit, n.arrival_date,
          n.report_total_usd, n.report_reimburse_total_usd, fileName,
          row.hash, rawJson, now, now,
        ],
      })
      summary.rowsInserted++
    }
  }

  return summary
}

// ── Phase 2: receipt-matching support ────────────────────────────────────────

export async function getExpenseById(id: string): Promise<ExpenseTransaction | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM expense_transactions WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseRow(result.rows[0] as Record<string, unknown>)
}

// Pulls expenses the worker should (re)search: unmatched or possible_match/needs_review,
// excluding terminal states (matched/no_receipt_required/ignored). Optionally throttles
// rows searched within `staleAfterMs` and caps the batch.
export async function getExpensesToSearch(opts: {
  limit?: number
  staleAfterMs?: number
} = {}): Promise<ExpenseTransaction[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT * FROM expense_transactions
          WHERE match_status IN ('unmatched','possible_match','needs_review')
          ORDER BY expense_date DESC, created_at DESC`,
    args: [],
  })
  let rows = result.rows.map((r) => parseRow(r as Record<string, unknown>))
  if (opts.staleAfterMs && opts.staleAfterMs > 0) {
    const cutoff = Date.now() - opts.staleAfterMs
    rows = rows.filter((r) => {
      if (!r.last_searched_at) return true
      const t = Date.parse(r.last_searched_at)
      return Number.isNaN(t) || t < cutoff
    })
  }
  if (opts.limit && opts.limit > 0) rows = rows.slice(0, opts.limit)
  return rows
}

// Count of expenses still eligible for matching (the worker's work list size).
export async function countExpensesToSearch(): Promise<number> {
  await runMigrations()
  const result = await turso.execute(
    `SELECT COUNT(*) AS c FROM expense_transactions
     WHERE match_status IN ('unmatched','possible_match','needs_review')`
  )
  return Number((result.rows[0] as Record<string, unknown>).c ?? 0)
}

export async function markExpenseSearched(id: string): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: 'UPDATE expense_transactions SET last_searched_at = ?, updated_at = ? WHERE id = ?',
    args: [now, now, id],
  })
}

// Applies the canonical match state to an expense row (see the state-machine table
// in docs/phase2-gmail-receipt-matching.md).
export async function setExpenseMatchState(
  id: string,
  data: {
    match_status: MatchStatus
    matched_receipt_file_id?: string | null
    confidence_score?: number | null
  }
): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `UPDATE expense_transactions
          SET match_status = ?, matched_receipt_file_id = ?, confidence_score = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      data.match_status,
      data.matched_receipt_file_id ?? null,
      data.confidence_score ?? null,
      now,
      id,
    ],
  })
}
