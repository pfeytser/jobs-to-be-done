'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ExpenseTransaction } from '@/lib/db/expenses'
import type { EnrichedMatch } from '@/lib/db/receipts'

const MATCH_STATUS_LABELS: Record<string, string> = {
  unmatched: 'Unmatched',
  matched: 'Matched',
  possible_match: 'Possible match',
  needs_review: 'Needs review',
  no_receipt_required: 'No receipt required',
  ignored: 'Ignored',
}

const RM_STATUS_LABELS: Record<string, string> = {
  candidate: 'Candidate',
  auto_matched: 'Auto-matched',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_review: 'Needs review',
}

const RM_STATUS_CLASSES: Record<string, string> = {
  candidate: 'bg-skipped-soft text-ink-soft',
  auto_matched: 'bg-pass-soft text-pass',
  approved: 'bg-pass-soft text-pass',
  rejected: 'bg-fail-soft text-fail',
  needs_review: 'bg-blocked-soft text-blocked',
}

function money(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function ExpenseDetail({
  expense,
  matches,
}: {
  expense: ExpenseTransaction
  matches: EnrichedMatch[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function act(matchId: string, action: 'approve' | 'reject') {
    setBusy(matchId + action)
    setError(null)
    try {
      const res = await fetch(`/api/expenses/${expense.id}/matches/${matchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Action failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/expenses/${expense.id}/receipt`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const fields: [string, string][] = [
    ['Expense Date', expense.expense_date ?? '—'],
    ['Merchant', expense.merchant || '—'],
    ['Amount (USD)', money(expense.amount_usd)],
    ['Receipt Amount (Original)', money(expense.receipt_amount_original)],
    ['Category', expense.category || '—'],
    ['Report', `${expense.report_name || '—'} (${expense.report_number || '—'})`],
    ['Card ID', expense.card_id || '—'],
    ['Statement Date', expense.statement_date ?? '—'],
  ]

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display leading-tight tracking-tight text-2xl font-light text-ink">{expense.merchant || 'Expense'}</h1>
        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-info text-ink-soft">
          {MATCH_STATUS_LABELS[expense.match_status] ?? expense.match_status}
        </span>
      </div>
      <p className="text-sm text-ink-muted mb-6">
        {expense.expense_date} · {money(expense.amount_usd)}
        {expense.receipt_amount_original != null && (
          <> · original {money(expense.receipt_amount_original)}</>
        )}
      </p>

      {/* Transaction details */}
      <div className="bg-surface border border-line rounded-md p-5 mb-6">
        <h2 className="text-sm font-semibold text-ink mb-3">Transaction</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-sm border-b border-line/60 py-1">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="text-ink text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-fail-soft border border-fail-line rounded-sm text-fail text-sm">
          {error}
        </div>
      )}

      {/* Candidate matches */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-ink mb-3">
          Receipt candidates {matches.length > 0 && `(${matches.length})`}
        </h2>
        {matches.length === 0 ? (
          <div className="bg-surface border border-line rounded-md p-6 text-center text-sm text-ink-muted">
            No candidates yet. Run the Gmail matcher, or upload a receipt manually below.
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <div key={m.id} className="bg-surface border border-line rounded-md p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${RM_STATUS_CLASSES[m.match_status] ?? 'bg-skipped-soft text-ink-soft'}`}>
                        {RM_STATUS_LABELS[m.match_status] ?? m.match_status}
                      </span>
                      <span className="text-sm font-semibold text-ink tabular-nums">{Math.round(m.confidence_score)}/100</span>
                      {m.account_label && (
                        <span className="text-xs text-ink-muted">
                          {m.account_label} &lt;{m.account_email}&gt;
                        </span>
                      )}
                    </div>
                    {m.file_subject && (
                      <p className="text-sm text-ink mt-1.5 truncate">{m.file_subject}</p>
                    )}
                    <p className="text-xs text-ink-muted mt-0.5">
                      {m.file_from && <span>{m.file_from}</span>}
                      {m.file_date && <span> · {new Date(m.file_date).toLocaleDateString()}</span>}
                      {m.matched_amount_type !== 'unknown' && m.matched_amount_value != null && (
                        <span> · matched {m.matched_amount_type === 'receipt_amount_original' ? 'original' : 'USD'} {money(m.matched_amount_value)}</span>
                      )}
                    </p>
                    {m.reason_summary && (
                      <p className="text-xs text-ink-muted mt-1 leading-relaxed">{m.reason_summary}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {m.receipt_file_id ? (
                        <a href={`/api/expenses/receipt-file/${m.receipt_file_id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-ink hover:underline">
                          View receipt PDF ↗
                        </a>
                      ) : (
                        <span className="text-xs text-ink-muted">No file stored yet</span>
                      )}
                      {m.file_source_url && (
                        <a href={m.file_source_url} target="_blank" rel="noreferrer" className="text-xs text-ink-muted hover:text-ink hover:underline">
                          Source link ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => act(m.id, 'approve')}
                      disabled={!!busy || m.match_status === 'approved'}
                      className="px-3 py-1.5 text-xs font-semibold bg-ink text-white rounded-xs hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      {busy === m.id + 'approve' ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => act(m.id, 'reject')}
                      disabled={!!busy || m.match_status === 'rejected'}
                      className="px-3 py-1.5 text-xs font-medium bg-canvas border border-line text-ink-soft rounded-xs hover:border-ink disabled:opacity-40 transition-colors"
                    >
                      {busy === m.id + 'reject' ? '…' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual upload */}
      <div className="bg-surface border border-line rounded-md p-5">
        <h2 className="text-sm font-semibold text-ink mb-1">Upload a receipt manually</h2>
        <p className="text-xs text-ink-muted mb-3">PDF or image. Attaches and marks this expense matched.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
          className="block w-full text-sm text-ink-soft file:mr-3 file:px-3 file:py-1.5 file:rounded-xs file:border-0 file:bg-ink file:text-white file:text-sm file:font-semibold hover:file:opacity-90"
        />
        {uploading && <p className="text-xs text-ink-muted mt-2">Uploading…</p>}
      </div>
    </div>
  )
}
