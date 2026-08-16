import type { ReactNode } from 'react'
import { QUADRANT_GRID, type AxisLabels, type QuadrantKey } from '@/lib/quadrant-model'

/**
 * The fixed 2×2, with axis names and pole captions on the edges. Presentational
 * only — the caller supplies each quadrant's contents (and, for the activity, its
 * own droppable container) via `renderQuadrant`. Shared by the activity, the
 * participant review, and the reveal so the grid reads identically everywhere.
 */
export function QuadrantFrame({
  axisLabels,
  renderQuadrant,
}: {
  axisLabels: AxisLabels
  renderQuadrant: (key: QuadrantKey) => ReactNode
}) {
  const a = axisLabels
  const cell = (key: QuadrantKey) => <div className="min-w-0">{renderQuadrant(key)}</div>

  return (
    <div>
      <p className="text-center text-[11px] font-bold uppercase tracking-widest text-ink-muted">{a.verticalAxis}</p>
      <p className="text-center text-xs font-semibold text-ink-soft mt-0.5 mb-2">▲ {a.verticalTop}</p>

      <div className="flex items-stretch gap-2 sm:gap-3">
        <div className="flex items-center shrink-0 w-16 sm:w-20">
          <span className="text-[11px] sm:text-xs font-semibold text-ink-soft text-right leading-tight w-full">
            {a.horizontalLeft}
          </span>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-3">
          {cell(QUADRANT_GRID.topLeft)}
          {cell(QUADRANT_GRID.topRight)}
          {cell(QUADRANT_GRID.bottomLeft)}
          {cell(QUADRANT_GRID.bottomRight)}
        </div>
        <div className="flex items-center shrink-0 w-16 sm:w-20">
          <span className="text-[11px] sm:text-xs font-semibold text-ink-soft leading-tight w-full">
            {a.horizontalRight}
          </span>
        </div>
      </div>

      <p className="text-center text-xs font-semibold text-ink-soft mt-2 mb-0.5">▼ {a.verticalBottom}</p>
      <p className="text-center text-[11px] font-bold uppercase tracking-widest text-ink-muted">{a.horizontalAxis}</p>
    </div>
  )
}
