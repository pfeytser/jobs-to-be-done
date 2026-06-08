import { turso } from './client'
import { runMigrations } from './migrations'

export const RECEIPT_SOURCE_TYPES = [
  'gmail_pdf_attachment',
  'gmail_email_body_pdf',
  'gmail_receipt_link_pdf',
  'gmail_receipt_link_printed_pdf',
  'manual_upload',
] as const
export type ReceiptSourceType = (typeof RECEIPT_SOURCE_TYPES)[number]

export const MATCH_METHODS = [
  'gmail_pdf_attachment',
  'gmail_email_body_pdf',
  'gmail_link_pdf',
  'gmail_link_printed_pdf',
  'manual_upload',
] as const
export type MatchMethod = (typeof MATCH_METHODS)[number]

export const RECEIPT_MATCH_STATUSES = [
  'candidate',
  'auto_matched',
  'approved',
  'rejected',
  'needs_review',
] as const
export type ReceiptMatchStatus = (typeof RECEIPT_MATCH_STATUSES)[number]

export const MATCHED_AMOUNT_TYPES = ['receipt_amount_original', 'amount_usd', 'unknown'] as const
export type MatchedAmountType = (typeof MATCHED_AMOUNT_TYPES)[number]

export interface ReceiptFile {
  id: string
  source_type: ReceiptSourceType
  storage_provider: string
  storage_url: string | null
  storage_file_id: string | null
  file_name: string
  mime_type: string
  sha256_hash: string
  email_account_id: string | null
  gmail_message_id: string | null
  gmail_thread_id: string | null
  gmail_subject: string | null
  gmail_from: string | null
  gmail_to: string | null
  gmail_date: string | null
  original_source_url: string | null
  extracted_text: string | null
  created_at: string
  updated_at: string
}

export interface ReceiptMatch {
  id: string
  expense_transaction_id: string
  receipt_file_id: string | null
  confidence_score: number
  match_method: string
  match_status: ReceiptMatchStatus
  matched_amount_type: MatchedAmountType
  matched_amount_value: number | null
  matched_email_account_id: string | null
  reason_summary: string
  created_at: string
  updated_at: string
}

function parseFile(row: Record<string, unknown>): ReceiptFile {
  return {
    id: row.id as string,
    source_type: (row.source_type as ReceiptSourceType) ?? 'manual_upload',
    storage_provider: (row.storage_provider as string) ?? 'vercel_blob',
    storage_url: (row.storage_url as string) ?? null,
    storage_file_id: (row.storage_file_id as string) ?? null,
    file_name: (row.file_name as string) ?? '',
    mime_type: (row.mime_type as string) ?? '',
    sha256_hash: (row.sha256_hash as string) ?? '',
    email_account_id: (row.email_account_id as string) ?? null,
    gmail_message_id: (row.gmail_message_id as string) ?? null,
    gmail_thread_id: (row.gmail_thread_id as string) ?? null,
    gmail_subject: (row.gmail_subject as string) ?? null,
    gmail_from: (row.gmail_from as string) ?? null,
    gmail_to: (row.gmail_to as string) ?? null,
    gmail_date: (row.gmail_date as string) ?? null,
    original_source_url: (row.original_source_url as string) ?? null,
    extracted_text: (row.extracted_text as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function parseMatch(row: Record<string, unknown>): ReceiptMatch {
  return {
    id: row.id as string,
    expense_transaction_id: row.expense_transaction_id as string,
    receipt_file_id: (row.receipt_file_id as string) ?? null,
    confidence_score: Number(row.confidence_score ?? 0),
    match_method: (row.match_method as string) ?? '',
    match_status: (row.match_status as ReceiptMatchStatus) ?? 'candidate',
    matched_amount_type: (row.matched_amount_type as MatchedAmountType) ?? 'unknown',
    matched_amount_value:
      row.matched_amount_value == null ? null : Number(row.matched_amount_value),
    matched_email_account_id: (row.matched_email_account_id as string) ?? null,
    reason_summary: (row.reason_summary as string) ?? '',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function newFileId(): string {
  return `rfile_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
function newMatchId(): string {
  return `rmatch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// ── Receipt files ────────────────────────────────────────────────────────────

export async function getReceiptFileById(id: string): Promise<ReceiptFile | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM receipt_files WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseFile(result.rows[0] as Record<string, unknown>)
}

// Finds an existing receipt file derived from a specific Gmail message + source type.
// Used to dedup email-body PDFs, whose rendered bytes (and thus sha256) vary per run.
export async function findReceiptFileByMessage(
  emailAccountId: string,
  gmailMessageId: string,
  sourceType: ReceiptSourceType
): Promise<ReceiptFile | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT * FROM receipt_files
          WHERE email_account_id = ? AND gmail_message_id = ? AND source_type = ?
          LIMIT 1`,
    args: [emailAccountId, gmailMessageId, sourceType],
  })
  if (!result.rows[0]) return null
  return parseFile(result.rows[0] as Record<string, unknown>)
}

export async function getReceiptFileByHash(hash: string): Promise<ReceiptFile | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM receipt_files WHERE sha256_hash = ? LIMIT 1',
    args: [hash],
  })
  if (!result.rows[0]) return null
  return parseFile(result.rows[0] as Record<string, unknown>)
}

export async function createReceiptFile(data: {
  source_type: ReceiptSourceType
  storage_provider?: string
  storage_url?: string | null
  storage_file_id?: string | null
  file_name: string
  mime_type: string
  sha256_hash: string
  email_account_id?: string | null
  gmail_message_id?: string | null
  gmail_thread_id?: string | null
  gmail_subject?: string | null
  gmail_from?: string | null
  gmail_to?: string | null
  gmail_date?: string | null
  original_source_url?: string | null
  extracted_text?: string | null
}): Promise<ReceiptFile> {
  await runMigrations()
  // Dedup re-runs by content hash.
  const existing = await getReceiptFileByHash(data.sha256_hash)
  if (existing) return existing

  const id = newFileId()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO receipt_files
      (id, source_type, storage_provider, storage_url, storage_file_id, file_name, mime_type,
       sha256_hash, email_account_id, gmail_message_id, gmail_thread_id, gmail_subject,
       gmail_from, gmail_to, gmail_date, original_source_url, extracted_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, data.source_type, data.storage_provider ?? 'vercel_blob', data.storage_url ?? null,
      data.storage_file_id ?? null, data.file_name, data.mime_type, data.sha256_hash,
      data.email_account_id ?? null, data.gmail_message_id ?? null, data.gmail_thread_id ?? null,
      data.gmail_subject ?? null, data.gmail_from ?? null, data.gmail_to ?? null,
      data.gmail_date ?? null, data.original_source_url ?? null, data.extracted_text ?? null,
      now, now,
    ],
  })
  return (await getReceiptFileById(id))!
}

// ── Receipt matches ──────────────────────────────────────────────────────────

export async function getMatchesForExpense(expenseId: string): Promise<ReceiptMatch[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM receipt_matches WHERE expense_transaction_id = ? ORDER BY confidence_score DESC, created_at DESC',
    args: [expenseId],
  })
  return result.rows.map((r) => parseMatch(r as Record<string, unknown>))
}

export async function getMatchById(id: string): Promise<ReceiptMatch | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM receipt_matches WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseMatch(result.rows[0] as Record<string, unknown>)
}

// Upserts a match by (expense, receipt_file). Re-running the worker updates the
// score/status rather than duplicating. Returns the match id.
export async function upsertReceiptMatch(data: {
  expense_transaction_id: string
  receipt_file_id: string | null
  confidence_score: number
  match_method: MatchMethod
  match_status: ReceiptMatchStatus
  matched_amount_type: MatchedAmountType
  matched_amount_value: number | null
  matched_email_account_id: string | null
  reason_summary: string
}): Promise<string> {
  await runMigrations()
  const now = new Date().toISOString()

  if (data.receipt_file_id) {
    const existing = await turso.execute({
      sql: 'SELECT id, match_status FROM receipt_matches WHERE expense_transaction_id = ? AND receipt_file_id = ?',
      args: [data.expense_transaction_id, data.receipt_file_id],
    })
    if (existing.rows[0]) {
      const id = (existing.rows[0] as Record<string, unknown>).id as string
      const currentStatus = (existing.rows[0] as Record<string, unknown>).match_status as string
      // Never let a re-run silently override a human decision.
      const humanLocked = currentStatus === 'approved' || currentStatus === 'rejected'
      await turso.execute({
        sql: `UPDATE receipt_matches SET confidence_score = ?, match_method = ?,
              match_status = ?, matched_amount_type = ?, matched_amount_value = ?,
              matched_email_account_id = ?, reason_summary = ?, updated_at = ?
              WHERE id = ?`,
        args: [
          data.confidence_score, data.match_method,
          humanLocked ? currentStatus : data.match_status,
          data.matched_amount_type, data.matched_amount_value,
          data.matched_email_account_id, data.reason_summary, now, id,
        ],
      })
      return id
    }
  }

  const id = newMatchId()
  await turso.execute({
    sql: `INSERT INTO receipt_matches
      (id, expense_transaction_id, receipt_file_id, confidence_score, match_method, match_status,
       matched_amount_type, matched_amount_value, matched_email_account_id, reason_summary,
       created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, data.expense_transaction_id, data.receipt_file_id ?? null, data.confidence_score,
      data.match_method, data.match_status, data.matched_amount_type, data.matched_amount_value,
      data.matched_email_account_id, data.reason_summary, now, now,
    ],
  })
  return id
}

export interface EnrichedMatch extends ReceiptMatch {
  file_storage_url: string | null
  file_name: string | null
  file_source_type: string | null
  file_subject: string | null
  file_from: string | null
  file_date: string | null
  file_source_url: string | null
  account_label: string | null
  account_email: string | null
}

// Matches for an expense joined with their receipt file + source account, for the
// detail view. Highest confidence first.
export async function getEnrichedMatchesForExpense(expenseId: string): Promise<EnrichedMatch[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT m.*,
            f.storage_url AS f_storage_url, f.file_name AS f_file_name,
            f.source_type AS f_source_type, f.gmail_subject AS f_subject,
            f.gmail_from AS f_from, f.gmail_date AS f_date, f.original_source_url AS f_url,
            a.account_label AS a_label, a.email_address AS a_email
          FROM receipt_matches m
          LEFT JOIN receipt_files f ON m.receipt_file_id = f.id
          LEFT JOIN connected_email_accounts a ON m.matched_email_account_id = a.id
          WHERE m.expense_transaction_id = ?
          ORDER BY m.confidence_score DESC, m.created_at DESC`,
    args: [expenseId],
  })
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      ...parseMatch(row),
      file_storage_url: (row.f_storage_url as string) ?? null,
      file_name: (row.f_file_name as string) ?? null,
      file_source_type: (row.f_source_type as string) ?? null,
      file_subject: (row.f_subject as string) ?? null,
      file_from: (row.f_from as string) ?? null,
      file_date: (row.f_date as string) ?? null,
      file_source_url: (row.f_url as string) ?? null,
      account_label: (row.a_label as string) ?? null,
      account_email: (row.a_email as string) ?? null,
    }
  })
}

export async function setMatchStatus(id: string, status: ReceiptMatchStatus): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE receipt_matches SET match_status = ?, updated_at = ? WHERE id = ?',
    args: [status, new Date().toISOString(), id],
  })
}

// Counts how many distinct expenses currently point at a given receipt file as a
// candidate/auto/needs_review match — used for the contention check.
export async function countExpensesForReceiptFile(receiptFileId: string): Promise<number> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT COUNT(DISTINCT expense_transaction_id) AS c FROM receipt_matches
          WHERE receipt_file_id = ? AND match_status IN ('candidate','auto_matched','needs_review')`,
    args: [receiptFileId],
  })
  return Number((result.rows[0] as Record<string, unknown>).c ?? 0)
}
