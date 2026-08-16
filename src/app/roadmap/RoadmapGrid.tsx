'use client'

import { useState } from 'react'
import type { Initiative, Priority } from '@/lib/roadmap/types'
import type { QuarterCapacity } from '@/lib/roadmap/capacity'
import { roundWeeks } from '@/lib/roadmap/capacity'
import { BACKLOG_LABEL, PRIORITY_META, QUARTERS, THEME_META, THEME_ORDER, quarterLabel, themeKey } from '@/lib/roadmap/types'
import { InitiativeCard } from './InitiativeCard'

export type GroupBy = 'theme' | 'objective' | 'none'
export type Orientation = 'quarters-cols' | 'quarters-rows'

export interface MoveTarget {
  year: number
  quarter: number
  groupKey: string
  unscheduled?: boolean
}

// The roadmap grid. One axis is the quarters, the other is the grouping (theme,
// objective, or a single "all" band); `orientation` decides which is which. Cards
// drag between cells (changing quarter, and theme/objective to match the drop band),
// onto a card to reorder, or into the "To Be Prioritized" bucket to unschedule.
export function RoadmapGrid({
  initiatives,
  capacity,
  groupBy,
  orientation,
  onOpen,
  onAdd,
  onMove,
}: {
  initiatives: Initiative[]
  capacity: QuarterCapacity[]
  groupBy: GroupBy
  orientation: Orientation
  onOpen: (i: Initiative) => void
  onAdd: (year: number, quarter: number) => void
  onMove?: (id: string, target: MoveTarget, beforeId?: string) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)

  const capByKey = new Map(capacity.map((c) => [`${c.year}-Q${c.quarter}`, c]))
  const flat = groupBy === 'none'

  let groups: { key: string; label: string; dot?: string }[]
  if (groupBy === 'theme') {
    groups = THEME_ORDER.map((k) => ({ key: k, label: THEME_META[k].label, dot: THEME_META[k].dot })).filter((g) =>
      initiatives.some((i) => i.unscheduled !== 1 && themeKey(i.theme) === g.key)
    )
  } else if (groupBy === 'objective') {
    const objectives = [...new Set(initiatives.filter((i) => i.unscheduled !== 1).map((i) => i.objective ?? '—'))].sort()
    groups = objectives.map((o) => ({ key: o, label: o === '—' ? 'No objective' : o }))
  } else {
    groups = [{ key: 'all', label: 'All initiatives' }]
  }

  const groupOf = (i: Initiative) =>
    groupBy === 'theme' ? themeKey(i.theme) : groupBy === 'objective' ? i.objective ?? '—' : 'all'

  const priorityRank = (p: Priority | null) => (p ? PRIORITY_META[p].rank : 99)
  const sortCards = (a: Initiative, b: Initiative) =>
    flat ? priorityRank(a.priority) - priorityRank(b.priority) || a.sort_order - b.sort_order : a.sort_order - b.sort_order

  const cardsFor = (groupKey: string, year: number, quarter: number) =>
    initiatives
      .filter((i) => i.unscheduled !== 1 && i.year === year && i.quarter === quarter && groupOf(i) === groupKey)
      .sort(sortCards)

  // A draggable initiative card. `target` is where a drop-on-this-card re-orders to.
  const DraggableCard = ({ i, target, cellKey }: { i: Initiative; target: MoveTarget; cellKey: string }) => (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        setDragId(i.id)
      }}
      onDragEnd={() => {
        setDragId(null)
        setOverKey(null)
      }}
      onDragOver={(e) => {
        if (dragId && dragId !== i.id) {
          e.preventDefault()
          e.stopPropagation()
          setOverKey(cellKey)
        }
      }}
      onDrop={(e) => {
        if (dragId && dragId !== i.id && onMove) {
          e.preventDefault()
          e.stopPropagation()
          onMove(dragId, target, i.id)
        }
        setDragId(null)
        setOverKey(null)
      }}
      className={dragId === i.id ? 'opacity-40' : 'cursor-grab active:cursor-grabbing'}
    >
      <InitiativeCard initiative={i} onClick={() => onOpen(i)} />
    </div>
  )

  const QuarterMeta = ({ year, quarter }: { year: number; quarter: number }) => {
    const c = capByKey.get(`${year}-Q${quarter}`)
    const over = c && c.headroomWeeks < 0
    return (
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-ink">{quarterLabel({ year, quarter })}</span>
          <button
            type="button"
            onClick={() => onAdd(year, quarter)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-base leading-none text-ink-muted hover:border-ink hover:text-ink"
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
  }

  const GroupLabel = ({ g }: { g: { label: string; dot?: string } }) => (
    <div className="flex items-start gap-2">
      {g.dot && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.dot }} />}
      <span className="text-[13px] font-semibold leading-tight text-ink">{g.label}</span>
    </div>
  )

  const Cell = ({ groupKey, year, quarter }: { groupKey: string; year: number; quarter: number }) => {
    const cards = cardsFor(groupKey, year, quarter)
    const cellKey = `${groupKey}:${year}-${quarter}`
    const target: MoveTarget = { year, quarter, groupKey }
    return (
      <div
        className={`min-h-[72px] space-y-2 p-2 transition-colors ${overKey === cellKey && dragId ? 'bg-accent-wash/70' : ''}`}
        onDragOver={(e) => {
          if (dragId) {
            e.preventDefault()
            setOverKey(cellKey)
          }
        }}
        onDragLeave={() => setOverKey((k) => (k === cellKey ? null : k))}
        onDrop={(e) => {
          e.preventDefault()
          if (dragId && onMove) onMove(dragId, target)
          setDragId(null)
          setOverKey(null)
        }}
      >
        {cards.map((i) => (
          <DraggableCard key={i.id} i={i} target={target} cellKey={cellKey} />
        ))}
      </div>
    )
  }

  // ── The "To Be Prioritized" bucket ───────────────────────────────────────────
  const backlogCards = initiatives
    .filter((i) => i.unscheduled === 1)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.sort_order - b.sort_order)
  const backlogTarget: MoveTarget = { year: QUARTERS[0].year, quarter: QUARTERS[0].quarter, groupKey: 'all', unscheduled: true }
  const backlogEl = (
    <div
      className={`rounded-xl border border-dashed border-line bg-canvas p-3 transition-colors ${
        overKey === 'backlog' && dragId ? 'bg-accent-wash/70' : ''
      }`}
      onDragOver={(e) => {
        if (dragId) {
          e.preventDefault()
          setOverKey('backlog')
        }
      }}
      onDragLeave={() => setOverKey((k) => (k === 'backlog' ? null : k))}
      onDrop={(e) => {
        e.preventDefault()
        if (dragId && onMove) onMove(dragId, backlogTarget)
        setDragId(null)
        setOverKey(null)
      }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-ink">{BACKLOG_LABEL}</span>
        <span className="text-[11px] text-ink-muted">
          {backlogCards.length} item{backlogCards.length === 1 ? '' : 's'} · not yet scheduled · no capacity impact
        </span>
      </div>
      {backlogCards.length === 0 ? (
        <p className="py-3 text-center text-xs text-ink-muted">
          Drag an initiative here to hold it for later prioritization.
        </p>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {backlogCards.map((i) => (
            <DraggableCard key={i.id} i={i} target={backlogTarget} cellKey="backlog" />
          ))}
        </div>
      )}
    </div>
  )

  // ── Grid element (either orientation) ────────────────────────────────────────
  let gridEl: React.ReactNode
  if (orientation === 'quarters-rows') {
    const nGroupCols = flat ? 1 : groups.length
    const rail = 170
    const gridCols = `${rail}px repeat(${nGroupCols}, minmax(220px, 1fr))`
    gridEl = (
      <div className="overflow-x-auto rounded-xl border border-line bg-canvas">
        <div style={{ minWidth: rail + nGroupCols * 220 }}>
          <div className="grid border-b border-line bg-surface" style={{ gridTemplateColumns: gridCols }}>
            <div className="p-3 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Quarter</div>
            {flat ? (
              <div className="border-l border-line p-3" />
            ) : (
              groups.map((g) => (
                <div key={g.key} className="border-l border-line p-3">
                  <GroupLabel g={g} />
                </div>
              ))
            )}
          </div>
          {QUARTERS.map((q) => (
            <div key={`${q.year}-${q.quarter}`} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: gridCols }}>
              <div className="bg-surface p-3">
                <QuarterMeta year={q.year} quarter={q.quarter} />
              </div>
              {(flat ? [{ key: 'all' }] : groups).map((g) => (
                <div key={g.key} className="border-l border-line">
                  <Cell groupKey={g.key} year={q.year} quarter={q.quarter} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  } else {
    const railWidth = flat ? 0 : 220
    const gridCols = flat
      ? `repeat(${QUARTERS.length}, minmax(220px, 1fr))`
      : `${railWidth}px repeat(${QUARTERS.length}, minmax(220px, 1fr))`
    gridEl = (
      <div className="overflow-x-auto rounded-xl border border-line bg-canvas">
        <div style={{ minWidth: railWidth + QUARTERS.length * 220 }}>
          <div className="grid border-b border-line bg-surface" style={{ gridTemplateColumns: gridCols }}>
            {!flat && (
              <div className="p-3 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                {groupBy === 'theme' ? 'Theme' : 'Objective'}
              </div>
            )}
            {QUARTERS.map((q) => (
              <div key={`${q.year}-${q.quarter}`} className="border-l border-line p-3 first:border-l-0">
                <QuarterMeta year={q.year} quarter={q.quarter} />
              </div>
            ))}
          </div>
          {groups.map((g) => (
            <div key={g.key} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: gridCols }}>
              {!flat && (
                <div className="bg-surface p-3">
                  <GroupLabel g={g} />
                </div>
              )}
              {QUARTERS.map((q) => (
                <div key={`${q.year}-${q.quarter}`} className="border-l border-line first:border-l-0">
                  <Cell groupKey={g.key} year={q.year} quarter={q.quarter} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {gridEl}
      {backlogEl}
    </div>
  )
}
