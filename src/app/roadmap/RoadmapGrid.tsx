'use client'

import { Fragment, useState } from 'react'
import type { Initiative, Quarter } from '@/lib/roadmap/types'
import type { QuarterCapacity, ScheduleSegment } from '@/lib/roadmap/capacity'
import { roundWeeks, straddleOriginPct } from '@/lib/roadmap/capacity'
import { BACKLOG_LABEL, THEME_META, THEME_ORDER, quarterLabel, themeKey } from '@/lib/roadmap/types'
import { InitiativeCard } from './InitiativeCard'

export type GroupBy = 'theme' | 'objective' | 'none'
export type Orientation = 'quarters-cols' | 'quarters-rows'
export type ReorderDir = 'top' | 'up' | 'down' | 'bottom'

export interface MoveTarget {
  year: number
  quarter: number
  groupKey: string
  unscheduled?: boolean
}

// A thin insertion line shown where a dragged card will drop.
const DropLine = () => <div className="mx-1 h-[3px] rounded-full bg-ink" />

const reorderBtn =
  'inline-flex h-5 w-5 items-center justify-center rounded border border-line bg-surface text-[11px] leading-none text-ink-soft hover:border-ink hover:text-ink disabled:opacity-30'

// The roadmap grid. One axis is the quarters, the other is the grouping (theme,
// objective, or a single "all" band); `orientation` decides which is which. Cards
// drag between cells (changing quarter, and theme/objective to match the drop band),
// onto a card to reorder, or into the "To Be Prioritized" bucket to unschedule.
export function RoadmapGrid({
  initiatives,
  capacity,
  quarters,
  schedule,
  groupBy,
  orientation,
  onOpen,
  onAdd,
  onMove,
  onReorder,
}: {
  initiatives: Initiative[]
  capacity: QuarterCapacity[]
  quarters: Quarter[]
  schedule: Map<string, ScheduleSegment[]>
  groupBy: GroupBy
  orientation: Orientation
  onOpen: (i: Initiative) => void
  onAdd: (year: number, quarter: number) => void
  onMove?: (id: string, target: MoveTarget, beforeId?: string) => void
  onReorder?: (id: string, dir: ReorderDir) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const [insertBefore, setInsertBefore] = useState<string | null>(null)

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

  // Manual stack order everywhere — it's also the order capacity is consumed in.
  const sortCards = (a: Initiative, b: Initiative) => a.sort_order - b.sort_order

  const cardsFor = (groupKey: string, year: number, quarter: number) =>
    initiatives
      .filter((i) => i.unscheduled !== 1 && i.year === year && i.quarter === quarter && groupOf(i) === groupKey)
      .sort(sortCards)

  // Continuation ("ghost") segments from initiatives whose home quarter is earlier
  // but whose work spills into this cell. They sit at the top and can't be moved.
  const byId = new Map(initiatives.map((i) => [i.id, i]))
  const ghostsFor = (groupKey: string, year: number, quarter: number) => {
    const out: { item: Initiative; pct: number }[] = []
    for (const [id, segs] of schedule) {
      const item = byId.get(id)
      if (!item || groupOf(item) !== groupKey) continue
      if (item.year === year && item.quarter === quarter) continue // that's the origin
      const seg = segs.find((s) => !s.isOrigin && s.year === year && s.quarter === quarter)
      if (seg) out.push({ item, pct: seg.pct })
    }
    return out.sort(
      (a, b) =>
        a.item.year - b.item.year || a.item.quarter - b.item.quarter || a.item.sort_order - b.item.sort_order
    )
  }

  // A fixed continuation card: muted, not draggable. Clicking opens the origin.
  const GhostCard = ({ i, pct }: { i: Initiative; pct: number }) => (
    <button
      type="button"
      onClick={() => onOpen(i)}
      className="w-full rounded-lg border border-dashed border-line bg-canvas/60 px-3 py-2 text-left opacity-90 hover:opacity-100"
      style={{ borderLeftWidth: 3, borderLeftColor: THEME_META[themeKey(i.theme)].dot, borderLeftStyle: 'solid' }}
      title="Continuation from an earlier quarter — edit it on its origin card"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium italic leading-snug text-ink-soft line-clamp-2">{i.title}</p>
        <span className="shrink-0 rounded-md bg-accent-wash px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-ink">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">↳ continues here</p>
    </button>
  )

  // A draggable initiative card. `target` is where a drop-on-this-card re-orders to.
  const DraggableCard = ({
    i,
    target,
    cellKey,
    percentThisQuarter,
    isFirst,
    isLast,
  }: {
    i: Initiative
    target: MoveTarget
    cellKey: string
    percentThisQuarter?: number | null
    isFirst?: boolean
    isLast?: boolean
  }) => {
    const reorder = (dir: ReorderDir) => (e: React.MouseEvent) => {
      e.stopPropagation()
      onReorder?.(i.id, dir)
    }
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          // setData is required for Firefox to start a drag at all.
          e.dataTransfer.setData('text/plain', i.id)
          // Defer the state change so the browser snapshots the (un-faded) card for
          // the drag image first. Setting it synchronously re-renders the node during
          // dragstart, which cancels the first drag and leaves the card stuck faded.
          const id = i.id
          setTimeout(() => setDragId(id), 0)
        }}
        onDragEnd={() => {
          setDragId(null)
          setOverKey(null)
          setInsertBefore(null)
        }}
        onDragOver={(e) => {
          if (dragId && dragId !== i.id) {
            e.preventDefault()
            e.stopPropagation()
            setOverKey(cellKey)
            setInsertBefore(i.id)
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
          setInsertBefore(null)
        }}
        className={`group/card relative ${dragId === i.id ? 'opacity-40' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <InitiativeCard initiative={i} onClick={() => onOpen(i)} percentThisQuarter={percentThisQuarter} />
        {onReorder && (
          <div className="absolute right-1 top-1 flex gap-0.5 rounded bg-surface/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover/card:opacity-100">
            <button type="button" className={reorderBtn} onClick={reorder('top')} disabled={isFirst} title="Move to top">
              ⤒
            </button>
            <button type="button" className={reorderBtn} onClick={reorder('up')} disabled={isFirst} title="Move up">
              ↑
            </button>
            <button type="button" className={reorderBtn} onClick={reorder('down')} disabled={isLast} title="Move down">
              ↓
            </button>
            <button type="button" className={reorderBtn} onClick={reorder('bottom')} disabled={isLast} title="Move to bottom">
              ⤓
            </button>
          </div>
        )}
      </div>
    )
  }

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
    const ghosts = ghostsFor(groupKey, year, quarter)
    const cellKey = `${groupKey}:${year}-${quarter}`
    const target: MoveTarget = { year, quarter, groupKey }
    // In list (flat) view the cell spans the full width, so cap the stacked cards
    // to a readable width instead of letting them stretch across the whole row.
    const containerCls = flat
      ? 'space-y-2 min-h-[72px] p-2 max-w-xl transition-colors'
      : 'space-y-2 min-h-[72px] p-2 transition-colors'
    return (
      <div
        className={`${containerCls} ${overKey === cellKey && dragId ? 'bg-accent-wash/40' : ''}`}
        onDragOver={(e) => {
          if (dragId) {
            e.preventDefault()
            setOverKey(cellKey)
            setInsertBefore(null) // over empty area → append at end
          }
        }}
        onDragLeave={() => setOverKey((k) => (k === cellKey ? null : k))}
        onDrop={(e) => {
          e.preventDefault()
          if (dragId && onMove) onMove(dragId, target)
          setDragId(null)
          setOverKey(null)
          setInsertBefore(null)
        }}
      >
        {ghosts.map(({ item, pct }) => (
          <GhostCard key={`ghost-${item.id}`} i={item} pct={pct} />
        ))}
        {cards.map((i, idx) => (
          <Fragment key={i.id}>
            {dragId && dragId !== i.id && insertBefore === i.id && <DropLine />}
            <DraggableCard
              i={i}
              target={target}
              cellKey={cellKey}
              percentThisQuarter={straddleOriginPct(schedule.get(i.id))}
              isFirst={idx === 0}
              isLast={idx === cards.length - 1}
            />
          </Fragment>
        ))}
        {dragId && overKey === cellKey && insertBefore === null && <DropLine />}
      </div>
    )
  }

  // ── The "To Be Prioritized" bucket ───────────────────────────────────────────
  const backlogCards = initiatives.filter((i) => i.unscheduled === 1).sort(sortCards)
  const backlogTarget: MoveTarget = { year: quarters[0].year, quarter: quarters[0].quarter, groupKey: 'all', unscheduled: true }
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
          {backlogCards.map((i, idx) => (
            <DraggableCard
              key={i.id}
              i={i}
              target={backlogTarget}
              cellKey="backlog"
              isFirst={idx === 0}
              isLast={idx === backlogCards.length - 1}
            />
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
          {quarters.map((q) => (
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
      ? `repeat(${quarters.length}, minmax(220px, 1fr))`
      : `${railWidth}px repeat(${quarters.length}, minmax(220px, 1fr))`
    gridEl = (
      <div className="overflow-x-auto rounded-xl border border-line bg-canvas">
        <div style={{ minWidth: railWidth + quarters.length * 220 }}>
          <div className="grid border-b border-line bg-surface" style={{ gridTemplateColumns: gridCols }}>
            {!flat && (
              <div className="p-3 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                {groupBy === 'theme' ? 'Theme' : 'Objective'}
              </div>
            )}
            {quarters.map((q) => (
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
              {quarters.map((q) => (
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
