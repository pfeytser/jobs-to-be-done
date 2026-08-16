'use client'

import type { QuarterCapacity } from '@/lib/roadmap/capacity'
import { roundWeeks } from '@/lib/roadmap/capacity'
import { quarterLabel } from '@/lib/roadmap/types'

// Utilization color: green under 85%, amber to 100%, red over capacity.
function utilColor(util: number): { bar: string; text: string; label: string } {
  if (util > 1) return { bar: 'bg-fail', text: 'text-fail', label: 'Over capacity' }
  if (util >= 0.85) return { bar: 'bg-accent', text: 'text-ink', label: 'Near capacity' }
  return { bar: 'bg-pass', text: 'text-pass', label: 'Headroom' }
}

export function CapacityRibbon({
  capacity,
  currentQuarterKey,
}: {
  capacity: QuarterCapacity[]
  currentQuarterKey: string
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${capacity.length}, minmax(0, 1fr))` }}>
      {capacity.map((q) => {
        const util = q.utilizationPct
        const c = utilColor(util)
        const fill = Math.min(100, util * 100)
        const isCurrent = `${q.year}-Q${q.quarter}` === currentQuarterKey
        const headroom = roundWeeks(q.headroomWeeks)
        return (
          <div
            key={`${q.year}-${q.quarter}`}
            className={`rounded-lg border bg-surface p-3 ${isCurrent ? 'border-ink' : 'border-line'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">{quarterLabel(q)}</span>
              {isCurrent && (
                <span className="rounded-full bg-ink px-1.5 py-0.5 text-[9px] font-bold uppercase text-surface">Now</span>
              )}
            </div>

            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums text-ink">{roundWeeks(q.committedWeeks)}</span>
              <span className="text-xs text-ink-muted">/ {roundWeeks(q.featureWeeks)}w feature</span>
            </div>

            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
              <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${fill}%` }} />
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className={`font-semibold ${c.text}`}>
                {headroom >= 0 ? `${headroom}w free` : `${Math.abs(headroom)}w over`}
              </span>
              <span className="text-ink-muted tabular-nums">{Math.round(util * 100)}%</span>
            </div>

            <div className="mt-2 border-t border-line pt-1.5 text-[10px] text-ink-muted">
              {roundWeeks(q.grossWeeks)}w gross · {Math.round(q.bauPct * 100)}% BAU · {q.engineerCount} eng
            </div>
          </div>
        )
      })}
    </div>
  )
}
