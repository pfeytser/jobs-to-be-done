'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TripWithEmails, TripCategory } from '@/lib/db/flights'

type Filter = 'all' | TripCategory

const CATEGORY_LABELS: Record<TripCategory, string> = {
  uncategorized: 'Uncategorized',
  business: 'Business',
  personal: 'Personal',
}

function money(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function distinctRoutes(t: TripWithEmails): string[] {
  return Array.from(new Set(t.emails.map((e) => e.route).filter((r): r is string => !!r)))
}
function distinctCodes(t: TripWithEmails): string[] {
  return Array.from(new Set(t.emails.map((e) => e.confirmation_code).filter((c): c is string => !!c)))
}

function gmailLink(accountEmail: string, e: { rfc822_message_id?: string | null; gmail_subject: string | null }): string {
  // `authuser=<email>` selects the right logged-in account by address (the /u/<index>
  // path needs a numeric index, not an email). Searching by the RFC822 Message-ID
  // opens the exact message reliably; fall back to a subject search.
  const base = `https://mail.google.com/mail/?authuser=${encodeURIComponent(accountEmail)}`
  const query = e.rfc822_message_id
    ? `rfc822msgid:${e.rfc822_message_id}`
    : (e.gmail_subject ?? '').slice(0, 80)
  return `${base}#search/${encodeURIComponent(query)}`
}

export function FlightsClient({ initialTrips }: { initialTrips: TripWithEmails[] }) {
  const router = useRouter()
  const [trips, setTrips] = useState(initialTrips)
  const [filter, setFilter] = useState<Filter>('all')
  const [scanning, setScanning] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [scanMsg, setScanMsg] = useState<string | null>(null)

  async function refresh(cat: Filter = filter) {
    const qs = cat === 'all' ? '' : `?category=${cat}`
    const res = await fetch(`/api/expenses/flights${qs}`)
    if (res.ok) setTrips((await res.json()).trips)
  }

  async function scan() {
    setScanning(true)
    setScanMsg(null)
    try {
      const res = await fetch('/api/expenses/flights/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      const s = data.summary
      setScanMsg(`Scanned ${s.messagesScanned} emails · ${s.flightEmailsFound} flight emails (${s.newEmails} new) · ${s.trips} trips`)
      await refresh()
      router.refresh()
    } catch (e) {
      setScanMsg(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  async function setCategory(tripId: string, category: TripCategory) {
    // optimistic
    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, category } : t)))
    await fetch(`/api/expenses/flights/trips/${tripId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    })
    refresh()
  }

  function applyFilter(f: Filter) {
    setFilter(f)
    refresh(f)
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const shown = filter === 'all' ? trips : trips.filter((t) => t.category === filter)
  const businessMissing = trips.filter((t) => t.category === 'business' && !t.has_expense).length

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          {(['all', 'business', 'personal', 'uncategorized'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => applyFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                filter === f ? 'bg-ink text-white border-ink' : 'bg-surface border-warm-border text-ink-2 hover:border-ink'
              }`}
            >
              {f === 'all' ? 'All' : CATEGORY_LABELS[f]}
            </button>
          ))}
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="px-4 py-2 text-sm font-semibold bg-gold text-ink rounded-[10px] hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
        >
          {scanning && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {scanning ? 'Scanning inboxes…' : 'Scan for flights'}
        </button>
      </div>

      {scanMsg && (
        <div className="mb-4 p-3 bg-surface border border-warm-border rounded-[12px] text-sm text-ink-2">{scanMsg}</div>
      )}

      {businessMissing > 0 && (
        <div className="mb-4 p-3 bg-status-blocked border border-status-blocked-border rounded-[12px] text-sm text-status-blocked-text">
          ⚠️ {businessMissing} business trip{businessMissing !== 1 ? 's have' : ' has'} no matching expense report — these may still need to be submitted.
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-surface border border-warm-border rounded-[14px] p-8 text-center text-sm text-ink-3">
          {trips.length === 0
            ? 'No flights found yet. Click "Scan for flights" to search both inboxes.'
            : 'No trips in this category.'}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((t) => (
            <div key={t.id} className="bg-surface border border-warm-border rounded-[14px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink">{t.airlines || 'Flight'}</span>
                    {distinctRoutes(t).map((r) => (
                      <span key={r} className="text-xs text-ink-2">{r}</span>
                    ))}
                    {distinctCodes(t).map((c) => (
                      <span key={c} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-canvas text-ink-2">{c}</span>
                    ))}
                  </div>
                  <p className="text-xs text-ink-3 mt-0.5">
                    {t.start_date ?? '—'}
                    {t.end_date && t.end_date !== t.start_date ? ` → ${t.end_date}` : ''}
                    {' · '}
                    {t.booking_count} booking{t.booking_count !== 1 ? 's' : ''} · {t.emails.length} email{t.emails.length !== 1 ? 's' : ''}
                    {t.total_amount != null && <> · {money(t.total_amount)}</>}
                  </p>

                  {/* Expense-report status (business only) */}
                  {t.category === 'business' && (
                    <p className="text-xs mt-1.5">
                      {t.has_expense ? (
                        <span className="text-status-pass-text">✓ Expense report found: {t.matched_reports.join(', ')}</span>
                      ) : (
                        <span className="text-status-fail-text font-medium">✗ No expense report found — may need submitting</span>
                      )}
                    </p>
                  )}

                  <button onClick={() => toggle(t.id)} className="text-xs text-ink-3 hover:text-ink mt-1.5">
                    {expanded.has(t.id) ? 'Hide emails ▴' : 'Show emails ▾'}
                  </button>
                  {expanded.has(t.id) && (
                    <div className="mt-2 space-y-1.5 border-t border-warm-border pt-2">
                      {t.emails.map((e) => (
                        <div key={e.id} className="text-xs">
                          <span className="text-ink">{e.gmail_subject || '(no subject)'}</span>
                          <span className="text-ink-3">
                            {' '}· {e.gmail_date ? new Date(e.gmail_date).toLocaleDateString() : '—'}
                            {e.amount != null && ` · ${money(e.amount)}`}
                          </span>
                          {e.account_email && (
                            <a
                              href={gmailLink(e.account_email, e)}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-ink-3 hover:text-ink hover:underline"
                            >
                              open in Gmail ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category selector */}
                <select
                  value={t.category}
                  onChange={(e) => setCategory(t.id, e.target.value as TripCategory)}
                  className={`shrink-0 px-2.5 py-1.5 text-xs font-medium border rounded-[8px] outline-none focus:border-ink ${
                    t.category === 'business'
                      ? 'bg-mist border-warm-border text-ink'
                      : t.category === 'personal'
                      ? 'bg-canvas border-warm-border text-ink-2'
                      : 'bg-surface border-warm-border text-ink-3'
                  }`}
                >
                  <option value="uncategorized">Uncategorized</option>
                  <option value="business">Business</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
