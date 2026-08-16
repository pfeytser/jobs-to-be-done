'use client'

import type { Initiative } from '@/lib/roadmap/types'
import { PRIORITY_META, STATUS_META, THEME_META, formatHours, formatRevenue, themeKey } from '@/lib/roadmap/types'

// A single roadmap initiative, echoing the card format from the source roadmap:
// a colored theme accent, title, effort in engineering-weeks, an impact chip,
// and small status/priority signals. Proposed (uncommitted) work is dimmed.
export function InitiativeCard({
  initiative,
  onClick,
}: {
  initiative: Initiative
  onClick: () => void
}) {
  const theme = THEME_META[themeKey(initiative.theme)]
  const status = STATUS_META[initiative.status]
  const revenue = formatRevenue(initiative.impact_revenue)
  const hours = formatHours(initiative.impact_hours)
  const priority = initiative.priority ? PRIORITY_META[initiative.priority] : null
  const uncommitted = initiative.committed === 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full text-left rounded-lg border bg-surface px-3 py-2.5 transition-all hover:-translate-y-px hover:shadow-md ${
        uncommitted ? 'border-dashed border-line opacity-80 hover:opacity-100' : 'border-line'
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: theme.dot, borderLeftStyle: 'solid' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold leading-snug text-ink line-clamp-2">{initiative.title}</p>
        {initiative.effort_weeks != null ? (
          <span className="shrink-0 rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-ink-soft">
            {initiative.effort_weeks}w
          </span>
        ) : (
          <span
            className="shrink-0 rounded-md bg-fail-soft px-1.5 py-0.5 text-[11px] font-bold text-fail"
            title="No effort estimate"
          >
            ?w
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
        {priority && (
          <span className={`text-[10px] font-bold uppercase tracking-wide ${priority.className}`}>{priority.label}</span>
        )}
        {(revenue || hours) && (
          <span className="ml-auto flex flex-wrap items-center justify-end gap-1">
            {revenue && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: theme.soft, color: theme.text }}>
                {revenue}
              </span>
            )}
            {hours && (
              <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{hours}</span>
            )}
          </span>
        )}
      </div>
    </button>
  )
}
