import {
  getExpensesToSearch,
  markExpenseSearched,
  setExpenseMatchState,
  getExpenseById,
  type ExpenseTransaction,
} from '@/lib/db/expenses'
import {
  listEmailAccounts,
  markAccountSynced,
  clearEmailAccountToken,
  type ConnectedEmailAccount,
} from '@/lib/db/email-accounts'
import {
  createReceiptFile,
  upsertReceiptMatch,
  getMatchesForExpense,
  setMatchStatus,
  findReceiptFileByMessage,
  type MatchMethod,
  type ReceiptMatchStatus,
} from '@/lib/db/receipts'
import { decryptToken } from './crypto'
import { clientFromRefreshToken, type ReceiptAuthClient } from './google-oauth'
import {
  buildGmailQuery,
  searchMessages,
  getMessage,
  downloadAttachment,
  type ParsedGmailMessage,
} from './gmail'
import { buildMerchantProfile } from './merchants'
import {
  scoreCandidate,
  shouldSkip,
  DEFAULT_SKIP_RULES,
  LINK_KEYWORDS,
  type SkipRules,
  type ScorableExpense,
  type CandidateScore,
} from './scoring'
import { storeReceiptBlob, sha256 } from './storage'
import { renderEmailToPdf } from './render-pdf'

export interface MatchConfig {
  maxExpensesPerRun: number
  dateWindowBeforeDays: number
  dateWindowAfterDays: number
  autoMatchThreshold: number
  possibleMatchThreshold: number
  candidateFloor: number // minimum score to record a candidate at all
  messagesPerQuery: number
  staleAfterMs?: number
  dryRun: boolean
  skipRules: SkipRules
  log: (msg: string) => void
}

export const DEFAULT_CONFIG: Omit<MatchConfig, 'log'> = {
  maxExpensesPerRun: 50,
  dateWindowBeforeDays: 3,
  dateWindowAfterDays: 7,
  autoMatchThreshold: 85,
  possibleMatchThreshold: 60,
  candidateFloor: 45,
  messagesPerQuery: 12,
  staleAfterMs: undefined,
  dryRun: false,
  skipRules: DEFAULT_SKIP_RULES,
}

export interface RunSummary {
  expensesConsidered: number
  skipped: number
  searched: number
  candidatesRecorded: number
  filesSaved: number
  autoMatched: number
  needsReview: number
  contentionDemotions: number
  accounts: { label: string; email: string; ok: boolean; note?: string }[]
  errors: string[]
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function withRetry<T>(fn: () => Promise<T>, label: string, log: (m: string) => void): Promise<T> {
  let delay = 500
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const status = (e as { code?: number; status?: number })?.code ?? (e as { status?: number })?.status
      const retriable = status === 429 || (typeof status === 'number' && status >= 500)
      if (!retriable || attempt === 3) throw e
      log(`  retry ${label} after ${delay}ms (status ${status})`)
      await new Promise((r) => setTimeout(r, delay))
      delay *= 2
    }
  }
  throw new Error('unreachable')
}

interface AuthedAccount {
  account: ConnectedEmailAccount
  client: ReceiptAuthClient
}

// Common single words that are too generic to use as a Gmail search token on their
// own (they match unrelated mail). When a token is generic we lean on the sender
// domain and/or a multi-word canonical phrase instead.
const GENERIC_TOKENS = new Set([
  'united', 'national', 'general', 'american', 'air', 'can', 'store', 'card',
  'office', 'group', 'the', 'order', 'noodle',
])

// Builds up to two complementary Gmail queries per expense, for maximum recall:
//   1. A precise `from:domain` query (when the vendor's sender domain is known) —
//      guarantees the vendor's own receipts are in the result set.
//   2. A name-token query — catches receipts sent by a billing PROCESSOR (e.g.
//      Stripe/Paddle for OpenAI/LottieLab) whose body mentions the merchant, and
//      vendors with no known domain. Generic single words are dropped to avoid noise.
// Running them separately means generic-word noise can't crowd the domain hits out
// of a single capped result set. Results are merged + deduped by the caller.
function buildQueries(expense: ExpenseTransaction, afterIso: string, beforeIso: string): string[] {
  const profile = buildMerchantProfile(expense.merchant)
  const queries: string[] = []

  if (profile.senderDomains.length > 0) {
    queries.push(buildGmailQuery({ tokens: [], fromDomains: profile.senderDomains, afterIso, beforeIso }))
  }

  const distinctive = Array.from(
    new Set([...profile.tokens, profile.canonical].filter((t) => t && !GENERIC_TOKENS.has(t)))
  )
  if (distinctive.length > 0) {
    queries.push(buildGmailQuery({ tokens: distinctive, afterIso, beforeIso }))
  }

  return Array.from(new Set(queries)) // dedupe identical query strings
}

function toScorable(e: ExpenseTransaction): ScorableExpense {
  return {
    merchant: e.merchant,
    category: e.category,
    amount_usd: e.amount_usd,
    receipt_amount_original: e.receipt_amount_original,
    expense_date: e.expense_date,
  }
}

function statusForScore(score: number, cfg: MatchConfig): ReceiptMatchStatus {
  if (score >= cfg.autoMatchThreshold) return 'auto_matched'
  if (score >= cfg.possibleMatchThreshold) return 'needs_review'
  return 'candidate'
}

interface PersistedCandidate {
  receiptFileId: string | null
  status: ReceiptMatchStatus
  score: number
}

// Acquires a receipt file for a candidate when warranted, returning its id (or null
// for a metadata-only candidate). Honors dry-run.
async function acquireReceiptFile(
  authed: AuthedAccount,
  msg: ParsedGmailMessage,
  candidate: CandidateScore,
  cfg: MatchConfig,
  summary: RunSummary
): Promise<{ receiptFileId: string | null; method: MatchMethod }> {
  const accountId = authed.account.id
  const worthFile = candidate.score >= cfg.possibleMatchThreshold
  const receiptLink = msg.links.find((l) =>
    LINK_KEYWORDS.some((k) => l.toLowerCase().includes(k))
  )

  // PDF attachment path
  if (worthFile && candidate.hasPdfAttachment) {
    const pdf =
      msg.attachments.find(
        (a) =>
          (a.mimeType === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf')) &&
          /receipt|invoice|folio|statement|booking/i.test(a.filename)
      ) ??
      msg.attachments.find(
        (a) => a.mimeType === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf')
      )
    if (pdf) {
      if (cfg.dryRun) return { receiptFileId: null, method: 'gmail_pdf_attachment' }
      const bytes = await withRetry(
        () => downloadAttachment(authed.client, msg.messageId, pdf.attachmentId),
        'attachment',
        cfg.log
      )
      const hash = sha256(bytes)
      const stored = await storeReceiptBlob(bytes, pdf.filename || 'receipt.pdf', 'application/pdf')
      const file = await createReceiptFile({
        source_type: 'gmail_pdf_attachment',
        storage_url: stored.storage_url,
        storage_file_id: stored.storage_file_id,
        file_name: stored.file_name,
        mime_type: 'application/pdf',
        sha256_hash: hash,
        email_account_id: accountId,
        gmail_message_id: msg.messageId,
        gmail_thread_id: msg.threadId,
        gmail_subject: msg.subject,
        gmail_from: msg.from,
        gmail_to: msg.to,
        gmail_date: msg.dateIso,
        original_source_url: receiptLink ?? null,
        extracted_text: msg.text.slice(0, 20_000),
      })
      summary.filesSaved++
      return { receiptFileId: file.id, method: 'gmail_pdf_attachment' }
    }
  }

  // Email-body PDF path (email IS the receipt)
  if (worthFile && !candidate.hasPdfAttachment) {
    if (cfg.dryRun) return { receiptFileId: null, method: 'gmail_email_body_pdf' }
    const existing = await findReceiptFileByMessage(accountId, msg.messageId, 'gmail_email_body_pdf')
    if (existing) return { receiptFileId: existing.id, method: 'gmail_email_body_pdf' }

    const pdf = await renderEmailToPdf(msg, {
      accountLabel: authed.account.account_label,
      from: msg.from,
      to: msg.to,
      date: msg.dateIso ?? '',
      subject: msg.subject,
      messageId: msg.messageId,
    })
    const stored = await storeReceiptBlob(
      pdf,
      `${(msg.subject || 'email').slice(0, 40)}.pdf`,
      'application/pdf'
    )
    const file = await createReceiptFile({
      source_type: 'gmail_email_body_pdf',
      storage_url: stored.storage_url,
      storage_file_id: stored.storage_file_id,
      file_name: stored.file_name,
      mime_type: 'application/pdf',
      sha256_hash: stored.sha256_hash,
      email_account_id: accountId,
      gmail_message_id: msg.messageId,
      gmail_thread_id: msg.threadId,
      gmail_subject: msg.subject,
      gmail_from: msg.from,
      gmail_to: msg.to,
      gmail_date: msg.dateIso,
      original_source_url: receiptLink ?? null,
      extracted_text: msg.text.slice(0, 20_000),
    })
    summary.filesSaved++
    return { receiptFileId: file.id, method: 'gmail_email_body_pdf' }
  }

  // Metadata-only candidate (below the file threshold) — no file generated yet.
  return {
    receiptFileId: null,
    method: candidate.hasPdfAttachment ? 'gmail_pdf_attachment' : 'gmail_email_body_pdf',
  }
}

// Recomputes an expense's canonical match state from all its (non-rejected) matches,
// respecting human approvals. Idempotent.
async function recomputeExpenseState(expenseId: string, cfg: MatchConfig): Promise<void> {
  const matches = (await getMatchesForExpense(expenseId)).filter((m) => m.match_status !== 'rejected')
  const approved = matches.find((m) => m.match_status === 'approved')
  const auto = matches.find((m) => m.match_status === 'auto_matched')
  const review = matches.find((m) => m.match_status === 'needs_review')

  if (approved) {
    await setExpenseMatchState(expenseId, {
      match_status: 'matched',
      matched_receipt_file_id: approved.receipt_file_id,
      confidence_score: approved.confidence_score,
    })
  } else if (auto) {
    await setExpenseMatchState(expenseId, {
      match_status: 'matched',
      matched_receipt_file_id: auto.receipt_file_id,
      confidence_score: auto.confidence_score,
    })
  } else if (review) {
    await setExpenseMatchState(expenseId, {
      match_status: 'possible_match',
      matched_receipt_file_id: null,
      confidence_score: review.confidence_score,
    })
  } else {
    await setExpenseMatchState(expenseId, {
      match_status: 'unmatched',
      matched_receipt_file_id: null,
      confidence_score: matches[0]?.confidence_score ?? null,
    })
  }
  void cfg
}

export async function runMatching(cfg: MatchConfig): Promise<RunSummary> {
  const summary: RunSummary = {
    expensesConsidered: 0,
    skipped: 0,
    searched: 0,
    candidatesRecorded: 0,
    filesSaved: 0,
    autoMatched: 0,
    needsReview: 0,
    contentionDemotions: 0,
    accounts: [],
    errors: [],
  }

  // 1. Authorize active accounts up front; flag any needing reconnect.
  const accounts = await listEmailAccounts(true)
  const authed: AuthedAccount[] = []
  for (const account of accounts) {
    if (!account.oauth_token_reference) {
      summary.accounts.push({ label: account.account_label, email: account.email_address, ok: false, note: 'no token — reconnect' })
      continue
    }
    try {
      const client = await clientFromRefreshToken(decryptToken(account.oauth_token_reference))
      authed.push({ account, client })
      summary.accounts.push({ label: account.account_label, email: account.email_address, ok: true })
    } catch {
      if (!cfg.dryRun) await clearEmailAccountToken(account.id)
      summary.accounts.push({ label: account.account_label, email: account.email_address, ok: false, note: 'token refresh failed — reconnect' })
    }
  }

  // 2. Pull the work list.
  const expenses = await getExpensesToSearch({
    limit: cfg.maxExpensesPerRun,
    staleAfterMs: cfg.staleAfterMs,
  })
  summary.expensesConsidered = expenses.length

  // Track which receipt files got auto-matched, per expense, for the contention pass.
  const autoByFile = new Map<string, string[]>() // receiptFileId -> expenseIds

  for (const expense of expenses) {
    // 2a. Skip list — no Gmail call.
    const skipReason = shouldSkip(toScorable(expense), cfg.skipRules)
    if (skipReason) {
      summary.skipped++
      cfg.log(`SKIP ${expense.merchant} (${expense.expense_date}) — ${skipReason}`)
      if (!cfg.dryRun) {
        await setExpenseMatchState(expense.id, { match_status: 'no_receipt_required' })
        await markExpenseSearched(expense.id)
      }
      continue
    }

    if (authed.length === 0) continue
    if (!expense.expense_date) {
      cfg.log(`skip (no expense_date): ${expense.id}`)
      continue
    }

    summary.searched++
    const afterIso = addDays(expense.expense_date, -cfg.dateWindowBeforeDays)
    const beforeIso = addDays(expense.expense_date, cfg.dateWindowAfterDays + 1)
    const queries = buildQueries(expense, afterIso, beforeIso)

    for (const a of authed) {
      // Run each query and merge unique messages so a domain hit and a body/token
      // hit are both considered, scored once each.
      const seen = new Set<string>()
      const messages: { id: string; threadId: string }[] = []
      for (const query of queries) {
        try {
          const found = await withRetry(
            () => searchMessages(a.client, query, cfg.messagesPerQuery),
            'search',
            cfg.log
          )
          for (const m of found) {
            if (!seen.has(m.id)) {
              seen.add(m.id)
              messages.push(m)
            }
          }
        } catch (e) {
          summary.errors.push(`search ${a.account.email_address}: ${e instanceof Error ? e.message : e}`)
        }
      }

      for (const m of messages) {
        let parsed: ParsedGmailMessage
        try {
          parsed = await withRetry(() => getMessage(a.client, m.id), 'get', cfg.log)
        } catch (e) {
          summary.errors.push(`get ${m.id}: ${e instanceof Error ? e.message : e}`)
          continue
        }

        const candidate = scoreCandidate(toScorable(expense), parsed, {
          windowBeforeDays: cfg.dateWindowBeforeDays,
          windowAfterDays: cfg.dateWindowAfterDays,
        })
        if (candidate.score < cfg.candidateFloor) continue

        const status = statusForScore(candidate.score, cfg)
        const reason = `[${a.account.account_label}] ${candidate.score}/100 · ${parsed.subject.slice(0, 60)} · ${candidate.reasons.join('; ')}`
        cfg.log(`  CANDIDATE ${candidate.score} (${status}) ${a.account.email_address} :: ${parsed.subject.slice(0, 70)}`)
        summary.candidatesRecorded++
        if (status === 'auto_matched') summary.autoMatched++
        if (status === 'needs_review') summary.needsReview++

        if (cfg.dryRun) continue

        // A single failed acquisition (e.g. Playwright unavailable on serverless,
        // or a flaky download) must not abort the whole run — fall back to a
        // metadata-only candidate and keep going.
        let receiptFileId: string | null = null
        let method: MatchMethod = candidate.hasPdfAttachment
          ? 'gmail_pdf_attachment'
          : 'gmail_email_body_pdf'
        try {
          const acq = await acquireReceiptFile(a, parsed, candidate, cfg, summary)
          receiptFileId = acq.receiptFileId
          method = acq.method
        } catch (e) {
          summary.errors.push(
            `acquire ${parsed.messageId}: ${e instanceof Error ? e.message : e}`
          )
        }
        await upsertReceiptMatch({
          expense_transaction_id: expense.id,
          receipt_file_id: receiptFileId,
          confidence_score: candidate.score,
          match_method: method,
          match_status: status,
          matched_amount_type: candidate.matched_amount_type,
          matched_amount_value: candidate.matched_amount_value,
          matched_email_account_id: a.account.id,
          reason_summary: reason,
        })

        if (status === 'auto_matched' && receiptFileId) {
          const list = autoByFile.get(receiptFileId) ?? []
          if (!list.includes(expense.id)) list.push(expense.id)
          autoByFile.set(receiptFileId, list)
        }
      }
    }

    if (!cfg.dryRun) await markExpenseSearched(expense.id)
  }

  // 3. Contention pass: a single receipt that auto-matched multiple expenses is
  //    ambiguous — demote all of them to needs_review.
  if (!cfg.dryRun) {
    for (const [receiptFileId, expenseIds] of autoByFile) {
      if (expenseIds.length <= 1) continue
      cfg.log(`CONTENTION: receipt ${receiptFileId} auto-matched ${expenseIds.length} expenses — demoting`)
      for (const expenseId of expenseIds) {
        const matches = await getMatchesForExpense(expenseId)
        for (const mt of matches) {
          if (mt.receipt_file_id === receiptFileId && mt.match_status === 'auto_matched') {
            await setMatchStatus(mt.id, 'needs_review')
            summary.contentionDemotions++
            summary.autoMatched = Math.max(0, summary.autoMatched - 1)
            summary.needsReview++
          }
        }
      }
    }

    // 4. Recompute each touched expense's canonical state, and mark synced accounts.
    for (const expense of expenses) {
      const fresh = await getExpenseById(expense.id)
      if (fresh && fresh.match_status !== 'no_receipt_required') {
        await recomputeExpenseState(expense.id, cfg)
      }
    }
    for (const a of authed) await markAccountSynced(a.account.id)
  }

  return summary
}
