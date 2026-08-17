'use client'

import { useState } from 'react'
import type { Engineer, PtoEntry, Quarter } from '@/lib/roadmap/types'
import { COUNTRY_META, quarterLabel } from '@/lib/roadmap/types'
import type { QuarterCapacity } from '@/lib/roadmap/capacity'
import { roundWeeks } from '@/lib/roadmap/capacity'

// The controls surface: the team roster (capacity fraction, country, join/leave
// windows, per-quarter PTO), the per-quarter BAU% levers, and a live breakdown of
// how each engineer's weeks roll up. Every edit recomputes capacity instantly.
export function TeamPanel({
  engineers,
  pto,
  capacity,
  quarters,
  onEngineerChange,
  onEngineerAdd,
  onEngineerDelete,
  onPtoChange,
  onBauChange,
}: {
  engineers: Engineer[]
  pto: PtoEntry[]
  capacity: QuarterCapacity[]
  quarters: Quarter[]
  onEngineerChange: (id: string, patch: Partial<Engineer>) => void
  onEngineerAdd: () => void
  onEngineerDelete: (id: string) => void
  onPtoChange: (engineerId: string, year: number, quarter: number, days: number) => void
  onBauChange: (year: number, quarter: number, pct: number) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const ptoOf = (engineerId: string, year: number, quarter: number) =>
    pto.find((p) => p.engineer_id === engineerId && p.year === year && p.quarter === quarter)?.days ?? 0

  return (
    <div className="space-y-6">
      {/* BAU levers — compact % inputs per quarter */}
      <section>
        <h3 className="text-sm font-bold text-ink">Bugs · tech debt · maintenance</h3>
        <p className="mt-0.5 text-xs text-ink-muted">
          Share of each quarter reserved for BAU. The rest is new-feature capacity.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {quarters.map((q) => {
            const cap = capacity.find((c) => c.year === q.year && c.quarter === q.quarter)
            const pct = cap ? Math.round(cap.bauPct * 100) : 20
            return (
              <div
                key={`${q.year}-${q.quarter}`}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5"
              >
                <span className="text-xs font-semibold text-ink">{quarterLabel(q).replace(' 20', " '")}</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    min={0}
                    max={95}
                    step={5}
                    value={pct}
                    onChange={(e) => onBauChange(q.year, q.quarter, Math.max(0, Math.min(95, Number(e.target.value))) / 100)}
                    className="w-12 rounded-md border border-line bg-canvas px-1.5 py-1 text-right text-sm tabular-nums text-ink focus:border-ink focus:outline-none"
                  />
                  <span className="ml-0.5 text-xs text-ink-muted">%</span>
                </div>
                <span className="text-[11px] tabular-nums text-ink-muted">→ {cap ? roundWeeks(cap.featureWeeks) : 0}w</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Roster */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Team roster</h3>
          <button
            type="button"
            onClick={onEngineerAdd}
            className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink hover:border-ink"
          >
            + Add engineer
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {engineers.map((e) => {
            const isOpen = expanded === e.id
            return (
              <div key={e.id} className={`rounded-lg border ${e.active ? 'border-line' : 'border-dashed border-line opacity-60'} bg-surface`}>
                <div className="flex flex-wrap items-center gap-2 p-2.5">
                  <input
                    value={e.name}
                    onChange={(ev) => onEngineerChange(e.id, { name: ev.target.value })}
                    className="min-w-[120px] flex-1 rounded-md border border-line bg-canvas px-2 py-1 text-sm font-semibold text-ink focus:border-ink focus:outline-none"
                  />
                  <select
                    value={e.country}
                    onChange={(ev) => onEngineerChange(e.id, { country: ev.target.value })}
                    className="rounded-md border border-line bg-canvas px-1.5 py-1 text-sm text-ink focus:border-ink focus:outline-none"
                    title="Country (drives public holidays)"
                  >
                    {Object.entries(COUNTRY_META).map(([code, m]) => (
                      <option key={code} value={code}>
                        {m.flag} {code}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1" title="Capacity (1 = full engineer)">
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={e.capacity_fraction}
                      onChange={(ev) => onEngineerChange(e.id, { capacity_fraction: Number(ev.target.value) })}
                      className="w-16 rounded-md border border-line bg-canvas px-2 py-1 text-sm tabular-nums text-ink focus:border-ink focus:outline-none"
                    />
                    <span className="text-xs text-ink-muted">FTE</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    className="rounded-md border border-line px-2 py-1 text-xs text-ink-soft hover:border-ink"
                  >
                    {isOpen ? 'Less' : 'Dates · PTO'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEngineerDelete(e.id)}
                    className="rounded-md border border-line px-2 py-1 text-xs text-fail hover:border-fail"
                    title="Remove engineer"
                  >
                    ✕
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-line px-2.5 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                        Joins
                        <input
                          type="date"
                          value={e.start_date ?? ''}
                          onChange={(ev) => onEngineerChange(e.id, { start_date: ev.target.value || null })}
                          className="rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink focus:border-ink focus:outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                        Leaves
                        <input
                          type="date"
                          value={e.end_date ?? ''}
                          onChange={(ev) => onEngineerChange(e.id, { end_date: ev.target.value || null })}
                          className="rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink focus:border-ink focus:outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <input
                          type="checkbox"
                          checked={e.active === 1}
                          onChange={(ev) => onEngineerChange(e.id, { active: ev.target.checked ? 1 : 0 })}
                          className="accent-[#1D5859]"
                        />
                        Active
                      </label>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">PTO days per quarter</p>
                      <div className="flex flex-wrap gap-2">
                        {quarters.map((q) => (
                          <label key={`${q.year}-${q.quarter}`} className="flex items-center gap-1 text-xs text-ink-soft">
                            {quarterLabel(q).replace(' 20', " '")}
                            <input
                              type="number"
                              min={0}
                              max={65}
                              value={ptoOf(e.id, q.year, q.quarter)}
                              onChange={(ev) => onPtoChange(e.id, q.year, q.quarter, Number(ev.target.value))}
                              className="w-14 rounded-md border border-line bg-canvas px-1.5 py-1 text-xs tabular-nums text-ink focus:border-ink focus:outline-none"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Breakdown */}
      <section>
        <h3 className="text-sm font-bold text-ink">Capacity breakdown</h3>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line bg-surface text-ink-muted">
                <th className="px-3 py-2 text-left font-semibold">Engineer</th>
                {quarters.map((q) => (
                  <th key={`${q.year}-${q.quarter}`} className="px-2 py-2 text-right font-semibold">
                    {quarterLabel(q).replace(' 20', " '")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {engineers
                .filter((e) => e.active === 1)
                .map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-1.5 text-ink">{e.name}</td>
                    {capacity.map((c) => {
                      const pe = c.perEngineer.find((p) => p.engineerId === e.id)
                      return (
                        <td key={`${c.year}-${c.quarter}`} className="px-2 py-1.5 text-right tabular-nums text-ink-soft">
                          {pe ? roundWeeks(pe.effectiveWeeks) : 0}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              <tr className="border-t-2 border-line bg-surface font-bold">
                <td className="px-3 py-2 text-ink">Gross weeks</td>
                {capacity.map((c) => (
                  <td key={`${c.year}-${c.quarter}`} className="px-2 py-2 text-right tabular-nums text-ink">
                    {roundWeeks(c.grossWeeks)}
                  </td>
                ))}
              </tr>
              <tr className="bg-surface font-bold text-pass">
                <td className="px-3 py-2">Feature weeks</td>
                {capacity.map((c) => (
                  <td key={`${c.year}-${c.quarter}`} className="px-2 py-2 text-right tabular-nums">
                    {roundWeeks(c.featureWeeks)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
