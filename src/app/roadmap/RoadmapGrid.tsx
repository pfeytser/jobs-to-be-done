'use client'

import type { Initiative, Priority } from '@/lib/roadmap/types'
import type { QuarterCapacity } from '@/lib/roadmap/capacity'
import { roundWeeks } from '@/lib/roadmap/capacity'
import { PRIORITY_META, QUARTERS, THEME_META, THEME_ORDER, quarterLabel, themeKey } from '@/lib/roadmap/types'
import { InitiativeCard } from './InitiativeCard'

export type GroupBy = 'theme' | 'objective' | 'none'

// The roadmap proper: quarters across the columns. Rows are banded by theme or
// objective, or — in 'none' mode — collapsed into a single flat list of the
// initiatives per quarter, ordered by priority.
export function RoadmapGrid({
  initiatives,
  capacity,
  groupBy,
  onOpen,
  onAdd,
}: {
  initiatives: Initiative[]
  capacity: QuarterCapacity[]
  groupBy: GroupBy
  onOpen: (i: Initiative) => void
  onAdd: (year: number, quarter: number) => void
}) {
  const capByKey = new Map(capacity.map((c) => [`${c.year}-Q${c.quarter}`, c]))
  const flat = groupBy === 'none'

  // Build the ordered list of row groups.
  let groups: { key: string; label: string; dot?: string }[]
  if (groupBy === 'theme') {
    groups = THEME_ORDER.map((k) => ({ key: k, label: THEME_META[k].label, dot: THEME_META[k].dot })).filter((g) =>
      initiatives.some((i) => themeKey(i.theme) === g.key)
    )
  } else if (groupBy === 'objective') {
    const objectives = [...new Set(initiatives.map((i) => i.objective ?? '—'))].sort()
    groups = objectives.map((o) => ({ key: o, label: o === '—' ? 'No objective' : o }))
  } else {
    groups = [{ key: 'all', label: 'All initiatives' }]
  }

  const groupOf = (i: Initiative) =>
    groupBy === 'theme' ? themeKey(i.theme) : groupBy === 'objective' ? i.objective ?? '—' : 'all'

  const priorityRank = (p: Priority | null) => (p ? PRIORITY_META[p].rank : 99)
  const sortCards = (a: Initiative, b: Initiative) =>
    flat ? priorityRank(a.priority) - priorityRank(b.priority) || a.sort_order - b.sort_order : a.sort_order - b.sort_order

  // Flat mode drops the left label rail; grouped modes keep a 220px rail.
  const railWidth = flat ? 0 : 220
  const gridCols = flat
    ? `repeat(${QUARTERS.length}, minmax(220px, 1fr))`
    : `${railWidth}px repeat(${QUARTERS.length}, minmax(220px, 1fr))`

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-canvas">
      <div style={{ minWidth: railWidth + QUARTERS.length * 220 }}>
        {/* Header row: quarter labels + committed/feature summary */}
        <div className="grid border-b border-line bg-surface" style={{ gridTemplateColumns: gridCols }}>
          {!flat && (
            <div className="p-3 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              {groupBy === 'theme' ? 'Theme' : 'Objective'}
            </div>
          )}
          {QUARTERS.map((q) => {
            const c = capByKey.get(`${q.year}-Q${q.quarter}`)
            const over = c && c.headroomWeeks < 0
            return (
              <div key={`${q.year}-${q.quarter}`} className="border-l border-line p-3 first:border-l-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">{quarterLabel(q)}</span>
                  <button
                    type="button"
                    onClick={() => onAdd(q.year, q.quarter)}
                    className="rounded-md border border-line px-1.5 text-sm leading-none text-ink-muted hover:border-ink hover:text-ink"
                    title="Add initiative to this quarter"
                  >
                    +
                  </button>
                </div>
                {c && (
                  <p className={`mt-0.5 text-[11px] tabular-nums ${over ? 'text-fail font-semibold' : 'text-ink-muted'}`}>
                    {roundWeeks(c.committedWeeks)} / {roundWeeks(c.featureWeeks)}w
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Body: one band per group (a single band in flat mode) */}
        {groups.map((g) => (
          <div key={g.key} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: gridCols }}>
            {!flat && (
              <div className="flex items-start gap-2 bg-surface p-3">
                {g.dot && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.dot }} />}
                <span className="text-[13px] font-semibold leading-tight text-ink">{g.label}</span>
              </div>
            )}
            {QUARTERS.map((q) => {
              const cell = initiatives
                .filter((i) => i.year === q.year && i.quarter === q.quarter && groupOf(i) === g.key)
                .sort(sortCards)
              return (
                <div key={`${q.year}-${q.quarter}`} className="min-h-[72px] space-y-2 border-l border-line p-2 first:border-l-0">
                  {cell.map((i) => (
                    <InitiativeCard key={i.id} initiative={i} onClick={() => onOpen(i)} />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
