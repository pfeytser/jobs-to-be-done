'use client'

import { useMemo, useState } from 'react'
import type { CompanyOffDay } from '@/lib/roadmap/types'
import { COUNTRY_META } from '@/lib/roadmap/types'
import { HOLIDAYS, HOLIDAY_COUNTRIES } from '@/lib/roadmap/holidays'

function fmt(date: string): { weekday: string; label: string; isWeekend: boolean } {
  const d = new Date(date + 'T00:00:00Z')
  const day = d.getUTCDay()
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
    isWeekend: day === 0 || day === 6,
  }
}

// Two calendars: (1) a read-only reference of each country's national public
// holidays (weekend ones are dimmed since they don't reduce capacity), and
// (2) an editable list of company-wide off days that count as team-wide PTO.
export function CalendarsPanel({
  companyOffDays,
  onAddOffDay,
  onDeleteOffDay,
}: {
  companyOffDays: CompanyOffDay[]
  onAddOffDay: (date: string, label: string) => void
  onDeleteOffDay: (id: string) => void
}) {
  const [country, setCountry] = useState<string>(HOLIDAY_COUNTRIES[0])
  const [newDate, setNewDate] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const holidays = useMemo(() => {
    const list = HOLIDAYS[country] ?? []
    const byYear: Record<string, typeof list> = {}
    for (const h of list) {
      const y = h.date.slice(0, 4)
      ;(byYear[y] ??= []).push(h)
    }
    return byYear
  }, [country])

  const sortedOff = useMemo(
    () => [...companyOffDays].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [companyOffDays]
  )

  const canAdd = /^\d{4}-\d{2}-\d{2}$/.test(newDate)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* National holidays */}
      <section>
        <h3 className="text-sm font-bold text-ink">National holidays</h3>
        <p className="mt-0.5 text-xs text-ink-muted">
          2026–2027. Weekday holidays reduce that country&apos;s engineers&apos; capacity; weekend ones are dimmed.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {HOLIDAY_COUNTRIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCountry(c)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                country === c ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-soft hover:border-ink'
              }`}
            >
              {COUNTRY_META[c].flag} {COUNTRY_META[c].label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-3">
          {Object.entries(holidays).map(([year, list]) => (
            <div key={year}>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">{year}</p>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {list.map((h) => {
                  const f = fmt(h.date)
                  const partial = h.fraction < 1
                  return (
                    <li
                      key={h.date}
                      className={`flex items-center gap-3 px-3 py-1.5 text-xs ${f.isWeekend ? 'opacity-45' : ''}`}
                    >
                      <span className="w-8 shrink-0 font-semibold text-ink-soft">{f.weekday}</span>
                      <span className="w-24 shrink-0 tabular-nums text-ink">{f.label}</span>
                      <span className="truncate text-ink-soft">{h.name}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        {partial && !f.isWeekend && (
                          <span className="rounded bg-accent-wash px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                            ½ day
                          </span>
                        )}
                        {f.isWeekend && <span className="text-[10px] text-ink-muted">weekend</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Company off-days */}
      <section>
        <h3 className="text-sm font-bold text-ink">Company off-days</h3>
        <p className="mt-0.5 text-xs text-ink-muted">
          Off-sites, all-hands, shutdowns — days the whole team is out. Counts as team-wide PTO in the capacity model.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3">
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Date
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Label
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Company off-site"
              className="min-w-[140px] rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => {
              onAddOffDay(newDate, newLabel.trim())
              setNewDate('')
              setNewLabel('')
            }}
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-40"
          >
            Add
          </button>
        </div>

        <div className="mt-3">
          {sortedOff.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-ink-muted">
              No company off-days yet.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {sortedOff.map((o) => {
                const f = fmt(o.date)
                return (
                  <li key={o.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${f.isWeekend ? 'opacity-45' : ''}`}>
                    <span className="w-8 shrink-0 font-semibold text-ink-soft">{f.weekday}</span>
                    <span className="w-24 shrink-0 tabular-nums text-ink">{f.label}</span>
                    <span className="truncate text-ink-soft">{o.label || 'Off day'}</span>
                    {f.isWeekend && <span className="shrink-0 text-[10px] text-ink-muted">weekend · no impact</span>}
                    <button
                      type="button"
                      onClick={() => onDeleteOffDay(o.id)}
                      className="ml-auto shrink-0 rounded-md border border-line px-1.5 py-0.5 text-fail hover:border-fail"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
