'use client'

import { useState } from 'react'
import type { MatrixCategory, AxisOption } from './MultiResultsView'

/** Clamp plotted points inside a margin so dots near the edges stay readable. */
const INSET = 6
const SPAN = 100 - INSET * 2

/** Categorical palette (cycles if there are more categories than colors). */
const CATEGORY_COLORS = [
  '#2563eb', '#db2777', '#16a34a', '#d97706',
  '#7c3aed', '#0891b2', '#dc2626', '#4b5563',
]

/** Within-category vertical position: rank 1 (most sticky) → top. */
function stickinessY(rank: number, n: number): number {
  return n > 1 && rank > 0 ? INSET + ((rank - 1) / (n - 1)) * SPAN : 50
}

/**
 * The portfolio view: every item across all categories on one larger matrix,
 * colored by category. Differentiation (X) is an absolute label so it compares
 * across categories directly; stickiness (Y) is normalized within each category
 * (rank → percentile), since participants only rank stickiness within a category.
 * Hovering (or tapping) a dot reveals the item's title.
 */
export function CombinedMatrix({
  categories,
  options,
  stickinessName,
  differentiationName,
}: {
  categories: MatrixCategory[]
  options: AxisOption[]
  stickinessName: string
  differentiationName: string
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const maxVal = Math.max(1, ...options.map((o) => o.value))
  const colorByCategory = new Map(
    categories.map((c, i) => [c.category, CATEGORY_COLORS[i % CATEGORY_COLORS.length]])
  )

  const points = categories.flatMap((cat) =>
    cat.items.map((it) => ({
      key: `${cat.category} ${it.id}`,
      it,
      category: cat.category,
      x: INSET + ((it.diffMean ?? 0) / maxVal) * SPAN,
      y: stickinessY(it.stickinessRank, cat.items.length),
      color: colorByCategory.get(cat.category) ?? '#4b5563',
    }))
  )

  return (
    <div>
      {/* Category legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
        {categories.map((cat) => (
          <span key={cat.category} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: colorByCategory.get(cat.category) ?? '#4b5563' }}
            />
            {cat.category}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col items-center justify-center py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted [writing-mode:vertical-rl] rotate-180">
            {stickinessName} (within category) →
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative w-full aspect-[3/2] rounded-lg border border-line bg-canvas overflow-hidden">
            {options.map((o) => {
              const left = INSET + (o.value / maxVal) * SPAN
              return (
                <div key={o.key} className="absolute top-0 bottom-0 border-l border-line/60" style={{ left: `${left}%` }} />
              )
            })}
            <div className="absolute left-0 right-0 top-1/2 border-t border-line/60" />

            {points.map(({ key, it, category, x, y, color }) => {
              const isHovered = hovered === key
              return (
                <div
                  key={key}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%`, zIndex: isHovered ? 20 : 1 }}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
                  onClick={() => setHovered((h) => (h === key ? null : key))}
                >
                  {isHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-ink text-white text-xs font-medium whitespace-nowrap shadow-lg pointer-events-none">
                      <span className="opacity-70">{category} · </span>
                      {it.title}
                    </div>
                  )}
                  <span
                    className={`block rounded-full ring-2 ring-canvas shadow cursor-pointer transition-transform ${
                      isHovered ? 'w-4 h-4 scale-110' : 'w-3.5 h-3.5'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                </div>
              )
            })}
          </div>

          <div className="relative h-5 mt-1">
            {options.map((o) => {
              const left = INSET + (o.value / maxVal) * SPAN
              return (
                <span
                  key={o.key}
                  className="absolute -translate-x-1/2 text-[10px] text-ink-muted whitespace-nowrap"
                  style={{ left: `${left}%` }}
                >
                  {o.label}
                </span>
              )
            })}
          </div>
          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-ink-muted mt-1">
            {differentiationName} →
          </p>
        </div>
      </div>
    </div>
  )
}
