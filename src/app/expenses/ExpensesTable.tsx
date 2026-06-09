'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import type {
  ExpenseTransaction,
  ExpenseFilterOptions,
  ExpenseFilters,
} from '@/lib/db/expenses'

const MATCH_STATUS_LABELS: Record<string, string> = {
  unmatched: 'Unmatched',
  matched: 'Matched',
  possible_match: 'Possible match',
  needs_review: 'Needs review',
  no_receipt_required: 'No receipt required',
  ignored: 'Ignored',
}

const MATCH_STATUS_CLASSES: Record<string, string> = {
  unmatched: 'bg-status-skipped text-ink-2',
  matched: 'bg-status-pass text-status-pass-text',
  possible_match: 'bg-status-blocked text-status-blocked-text',
  needs_review: 'bg-status-blocked text-status-blocked-text',
  no_receipt_required: 'bg-mist text-ink-2',
  ignored: 'bg-status-skipped text-ink-3',
}

type SortKey =
  | 'expense_date'
  | 'statement_date'
  | 'merchant'
  | 'amount_usd'
  | 'receipt_amount_original'

function money(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function date(s: string | null): string {
  return s && s.trim() ? s : '—'
}

interface Props {
  initialTransactions: ExpenseTransaction[]
  initialOptions: ExpenseFilterOptions
}

export function ExpensesTable({ initialTransactions, initialOptions }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [options, setOptions] = useState(initialOptions)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<ExpenseFilters>({})
  const [sortBy, setSortBy] = useState<SortKey>('expense_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const firstRender = useRef(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{
    autoMatched: number
    needsReview: number
    skipped: number
    filesSaved: number
    remaining: number
    errors: number
  } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v)
      }
      params.set('sort_by', sortBy)
      params.set('sort_dir', sortDir)
      const res = await fetch(`/api/expenses?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setTransactions(data.transactions)
        setOptions(data.options)
      }
    } finally {
      setLoading(false)
    }
  }, [filters, sortBy, sortDir])

  useEffect(() => {
    // Skip the initial fetch — the server already provided the first page.
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    fetchData()
  }, [fetchData])

  async function runMatcher() {
    setRunning(true)
    try {
      const res = await fetch('/api/expenses/match/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max: 25 }),
      })
      const data = await res.json()
      if (res.ok) {
        setRunResult({
          autoMatched: data.summary.autoMatched,
          needsReview: data.summary.needsReview,
          skipped: data.summary.skipped,
          filesSaved: data.summary.filesSaved,
          remaining: data.remaining,
          errors: data.summary.errors?.length ?? 0,
        })
        await fetchData()
      } else {
        setRunResult(null)
        alert(data.error ?? 'Run failed')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  function setFilter(key: keyof ExpenseFilters, value: string) {
    setFilters((prev) => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  }

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  function clearFilters() {
    setFilters({})
  }

  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount_usd ?? 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Expense Transactions</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            {' · '}
            {money(totalAmount)} total (USD)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runMatcher}
            disabled={running}
            className="px-4 py-2 text-sm font-semibold bg-gold text-ink rounded-[10px] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {running && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {running ? 'Searching Gmail…' : 'Run matcher'}
          </button>
          <Link
            href="/expenses/flights"
            className="px-4 py-2 text-sm font-medium bg-surface border border-warm-border text-ink rounded-[10px] hover:border-ink transition-colors"
          >
            ✈ Flights
          </Link>
          <Link
            href="/expenses/coupa-upload"
            className="px-4 py-2 text-sm font-medium bg-surface border border-warm-border text-ink rounded-[10px] hover:border-ink transition-colors"
          >
            Coupa upload
          </Link>
          <Link
            href="/expenses/accounts"
            className="px-4 py-2 text-sm font-medium bg-surface border border-warm-border text-ink rounded-[10px] hover:border-ink transition-colors"
          >
            Gmail accounts
          </Link>
          <Link
            href="/expenses/import"
            className="px-4 py-2 text-sm font-semibold bg-ink text-white rounded-[10px] hover:opacity-90 transition-opacity"
          >
            Import CSV
          </Link>
        </div>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div className="mb-4 p-3 bg-surface border border-warm-border rounded-[12px] flex items-center justify-between gap-3 text-sm">
          <span className="text-ink">
            Run complete: <strong>{runResult.autoMatched}</strong> auto-matched,{' '}
            <strong>{runResult.needsReview}</strong> to review,{' '}
            <strong>{runResult.skipped}</strong> skipped, <strong>{runResult.filesSaved}</strong> receipts saved
            {runResult.errors > 0 && <span className="text-status-blocked-text"> · {runResult.errors} errors</span>}
            {' · '}
            <span className="text-ink-2">{runResult.remaining} expense{runResult.remaining !== 1 ? 's' : ''} still to process</span>
          </span>
          {runResult.remaining > 0 && (
            <button
              onClick={runMatcher}
              disabled={running}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-ink text-white rounded-[8px] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Run again
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-surface border border-warm-border rounded-[14px] p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterSelect
            label="Match Status"
            value={filters.match_status ?? ''}
            onChange={(v) => setFilter('match_status', v)}
            options={options.match_statuses.map((s) => ({
              value: s,
              label: MATCH_STATUS_LABELS[s] ?? s,
            }))}
          />
          <FilterSelect
            label="Category"
            value={filters.category ?? ''}
            onChange={(v) => setFilter('category', v)}
            options={options.categories.map((s) => ({ value: s, label: s }))}
          />
          <FilterSelect
            label="Report Name"
            value={filters.report_name ?? ''}
            onChange={(v) => setFilter('report_name', v)}
            options={options.report_names.map((s) => ({ value: s, label: s }))}
          />
          <FilterSelect
            label="Reimburse to Employee"
            value={filters.reimburse_to_employee ?? ''}
            onChange={(v) => setFilter('reimburse_to_employee', v)}
            options={options.reimburse_to_employee.map((s) => ({ value: s, label: s }))}
          />
          <FilterText
            label="Merchant"
            value={filters.merchant ?? ''}
            onChange={(v) => setFilter('merchant', v)}
            placeholder="Contains…"
          />
          <FilterSelect
            label="Source File"
            value={filters.source_file_name ?? ''}
            onChange={(v) => setFilter('source_file_name', v)}
            options={options.source_file_names.map((s) => ({ value: s, label: s }))}
          />
          <FilterDateRange
            label="Expense Date"
            from={filters.expense_date_from ?? ''}
            to={filters.expense_date_to ?? ''}
            onFrom={(v) => setFilter('expense_date_from', v)}
            onTo={(v) => setFilter('expense_date_to', v)}
          />
          <FilterDateRange
            label="Statement Date"
            from={filters.statement_date_from ?? ''}
            to={filters.statement_date_to ?? ''}
            onFrom={(v) => setFilter('statement_date_from', v)}
            onTo={(v) => setFilter('statement_date_to', v)}
          />
        </div>
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-warm-border">
            <span className="text-xs text-ink-3">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
            <button
              onClick={clearFilters}
              className="text-xs font-medium text-ink hover:underline"
            >
              Clear all
            </button>
            {loading && <span className="text-xs text-ink-3">Loading…</span>}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-warm-border rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-border bg-canvas text-left">
                <SortHeader label="Expense Date" sortKey="expense_date" active={sortBy} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Merchant" sortKey="merchant" active={sortBy} dir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2.5 font-semibold text-ink-2 whitespace-nowrap">Category</th>
                <SortHeader label="Amount (USD)" sortKey="amount_usd" active={sortBy} dir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader label="Receipt Amt (Orig.)" sortKey="receipt_amount_original" active={sortBy} dir={sortDir} onClick={toggleSort} align="right" />
                <th className="px-3 py-2.5 font-semibold text-ink-2 whitespace-nowrap">Report Name</th>
                <th className="px-3 py-2.5 font-semibold text-ink-2 whitespace-nowrap">Report #</th>
                <th className="px-3 py-2.5 font-semibold text-ink-2 whitespace-nowrap">Card ID</th>
                <th className="px-3 py-2.5 font-semibold text-ink-2 whitespace-nowrap">Reimburse</th>
                <th className="px-3 py-2.5 font-semibold text-ink-2 whitespace-nowrap">Match Status</th>
                <th className="px-3 py-2.5 font-semibold text-ink-2 whitespace-nowrap">Confidence</th>
                <th className="px-3 py-2.5 font-semibold text-ink-2 whitespace-nowrap">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-12 text-center text-ink-3">
                    No transactions found.{' '}
                    <Link href="/expenses/import" className="text-ink font-medium hover:underline">
                      Import a Coupa CSV
                    </Link>{' '}
                    to get started.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="border-b border-warm-border last:border-0 hover:bg-canvas/60">
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink">{date(t.expense_date)}</td>
                    <td className="px-3 py-2.5 text-ink font-medium">
                      <Link href={`/expenses/${t.id}`} className="hover:underline">
                        {t.merchant || '—'}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{t.category || '—'}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-ink tabular-nums">{money(t.amount_usd)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-ink tabular-nums font-medium">{money(t.receipt_amount_original)}</td>
                    <td className="px-3 py-2.5 text-ink-2">{t.report_name || '—'}</td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{t.report_number || '—'}</td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{t.card_id || '—'}</td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{t.reimburse_to_employee || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${MATCH_STATUS_CLASSES[t.match_status] ?? 'bg-status-skipped text-ink-2'}`}>
                        {MATCH_STATUS_LABELS[t.match_status] ?? t.match_status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap tabular-nums">
                      {t.confidence_score == null ? '—' : `${Math.round(t.confidence_score)}%`}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {t.matched_receipt_file_id ? (
                        <span className="text-status-pass-text text-xs">✓ Attached</span>
                      ) : (
                        <span className="text-ink-3 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  active: SortKey
  dir: 'asc' | 'desc'
  onClick: (k: SortKey) => void
  align?: 'left' | 'right'
}) {
  const isActive = active === sortKey
  return (
    <th className={`px-3 py-2.5 font-semibold text-ink-2 whitespace-nowrap ${align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-ink transition-colors ${isActive ? 'text-ink' : ''}`}
      >
        {label}
        <span className="text-ink-3">{isActive ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-2 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm bg-canvas border border-warm-border rounded-[8px] text-ink focus:border-ink outline-none"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function FilterText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-2 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm bg-canvas border border-warm-border rounded-[8px] text-ink focus:border-ink outline-none"
      />
    </label>
  )
}

function FilterDateRange({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-2 mb-1">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-canvas border border-warm-border rounded-[8px] text-ink focus:border-ink outline-none"
        />
        <span className="text-ink-3 text-xs">–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-canvas border border-warm-border rounded-[8px] text-ink focus:border-ink outline-none"
        />
      </div>
    </label>
  )
}
