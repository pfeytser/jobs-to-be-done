import { buildMerchantProfile, senderDomainMatches, merchantTokenScore } from './merchants'
import { extractAmounts, amountPresent } from './amounts'
import type { MatchedAmountType } from '@/lib/db/receipts'

export const TRANSACTIONAL_KEYWORDS = [
  'receipt', 'invoice', 'order', 'confirmation', 'payment', 'booking',
  'trip', 'fare', 'folio', 'statement',
]
const PROMO_MARKERS = [
  'unsubscribe', '% off', 'sale', 'deal', 'newsletter', 'limited time',
  'shop now', 'view in browser', 'promo',
]
export const LINK_KEYWORDS = [
  'receipt', 'invoice', 'download', 'pdf', 'billing', 'folio', 'statement', 'order', 'booking',
]
const ATTACHMENT_NAME_KEYWORDS = ['receipt', 'invoice', 'folio', 'statement', 'booking']

// Minimal expense shape the scorer needs.
export interface ScorableExpense {
  merchant: string
  category: string
  amount_usd: number | null
  receipt_amount_original: number | null
  expense_date: string | null
}

export interface EmailAttachmentMeta {
  filename: string
  mimeType: string
}

// Minimal email shape the scorer needs (no Gmail SDK dependency).
export interface ScorableEmail {
  subject: string
  from: string
  to: string
  dateIso: string | null
  text: string
  html: string
  attachments: EmailAttachmentMeta[]
}

export interface CandidateScore {
  score: number // clamped 0..100
  matched_amount_type: MatchedAmountType
  matched_amount_value: number | null
  reasons: string[]
  hasPdfAttachment: boolean
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso)
  const b = Date.parse(bIso)
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity
  return Math.abs(a - b) / 86_400_000
}

// ── Skip list ────────────────────────────────────────────────────────────────
// Rows that will never have a Gmail receipt — auto-set to no_receipt_required and
// never searched. Each rule is independently toggleable for tuning.
export interface SkipRules {
  bankFees: boolean
  negativeAmounts: boolean
  recurringMembership: boolean
}

export const DEFAULT_SKIP_RULES: SkipRules = {
  bankFees: true,
  negativeAmounts: true,
  recurringMembership: true,
}

const MEMBERSHIP_MERCHANTS = ['industriousoffice.com', 'industrious office']

export function shouldSkip(e: ScorableExpense, rules: SkipRules): string | null {
  const merchant = (e.merchant ?? '').toLowerCase()
  const category = (e.category ?? '').toLowerCase()
  if (rules.bankFees && (merchant.includes('currency conversion fee') || category.includes('bank fees'))) {
    return 'Bank/currency-conversion fee — no receipt expected'
  }
  if (rules.negativeAmounts && e.amount_usd != null && e.amount_usd < 0) {
    return 'Negative amount (refund/reversal) — no receipt expected'
  }
  if (
    rules.recurringMembership &&
    MEMBERSHIP_MERCHANTS.some((m) => merchant.includes(m)) &&
    category === 'description required'
  ) {
    return 'Recurring membership charge — no receipt expected'
  }
  return null
}

// ── Candidate scoring ────────────────────────────────────────────────────────
export interface ScoreOptions {
  windowBeforeDays: number
  windowAfterDays: number
}

export function scoreCandidate(
  expense: ScorableExpense,
  email: ScorableEmail,
  opts: ScoreOptions
): CandidateScore {
  const reasons: string[] = []
  let score = 0

  const profile = buildMerchantProfile(expense.merchant)
  const subjectFrom = `${email.subject} ${email.from}`
  const bodyText = `${email.text}\n${stripHtml(email.html)}`
  const allText = `${subjectFrom}\n${bodyText}`
  const amounts = extractAmounts(allText)

  // 1. Amount — prioritize receipt_amount_original; fall back to amount_usd when null.
  const hasOriginal = expense.receipt_amount_original != null
  const primary = hasOriginal ? expense.receipt_amount_original! : expense.amount_usd
  const primaryType: MatchedAmountType = hasOriginal ? 'receipt_amount_original' : 'amount_usd'
  let matched_amount_type: MatchedAmountType = 'unknown'
  let matched_amount_value: number | null = null

  if (primary != null && amountPresent(amounts, primary)) {
    score += 45
    matched_amount_type = primaryType
    matched_amount_value = Math.abs(primary)
    reasons.push(`Amount ${matched_amount_value} matches ${primaryType}`)
  } else if (hasOriginal && expense.amount_usd != null && amountPresent(amounts, expense.amount_usd)) {
    score += 20
    matched_amount_type = 'amount_usd'
    matched_amount_value = Math.abs(expense.amount_usd)
    reasons.push(`Only USD amount ${matched_amount_value} matches (not original)`)
  }

  // 2. Merchant — sender domain is strongest, then subject/from token, then body.
  if (senderDomainMatches(profile, email.from)) {
    score += 25
    reasons.push(`Sender domain matches ${profile.canonical}`)
  } else {
    const sf = merchantTokenScore(profile, subjectFrom)
    const bd = merchantTokenScore(profile, bodyText)
    if (sf >= 0.5) {
      score += 15
      reasons.push(`Merchant tokens in subject/from`)
    } else if (bd >= 0.5) {
      score += 8
      reasons.push(`Merchant tokens in body`)
    } else if (sf === 0 && bd === 0) {
      score -= 10
      reasons.push(`Weak/garbled merchant match`)
    }
  }

  // 3. Date proximity.
  if (expense.expense_date && email.dateIso) {
    const dist = daysBetween(expense.expense_date, email.dateIso)
    const maxWin = Math.max(opts.windowBeforeDays, opts.windowAfterDays)
    if (dist <= maxWin) {
      const proximity = Math.max(0, 1 - dist / (maxWin + 1))
      score += Math.round(10 * proximity)
      reasons.push(`Email ${dist.toFixed(0)}d from expense date`)
    } else {
      score -= 20
      reasons.push(`Email ${dist.toFixed(0)}d from expense date (far)`)
    }
  }

  // 4. Transactional keyword in subject.
  const subjLower = email.subject.toLowerCase()
  if (TRANSACTIONAL_KEYWORDS.some((k) => subjLower.includes(k))) {
    score += 8
    reasons.push('Transactional keyword in subject')
  }

  // 5. Attachments.
  const hasPdfAttachment = email.attachments.some(
    (a) => a.mimeType === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf')
  )
  if (hasPdfAttachment) {
    score += 8
    reasons.push('PDF attachment present')
    if (
      email.attachments.some((a) =>
        ATTACHMENT_NAME_KEYWORDS.some((k) => a.filename.toLowerCase().includes(k))
      )
    ) {
      score += 7
      reasons.push('Attachment filename looks like a receipt')
    }
  }

  // 6. Promotional penalty.
  if (PROMO_MARKERS.some((m) => allText.toLowerCase().includes(m))) {
    score -= 30
    reasons.push('Looks promotional/marketing')
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  return { score, matched_amount_type, matched_amount_value, reasons, hasPdfAttachment }
}

function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export { stripHtml }
