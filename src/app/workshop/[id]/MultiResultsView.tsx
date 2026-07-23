import Link from 'next/link'
import { CombinedMatrix } from './CombinedMatrix'

export interface MatrixItem {
  id: string
  title: string
  description: string
  /** 1 = most sticky (top of the Y axis). 0 if unranked. */
  stickinessRank: number
  /** Mean differentiation value across voters (null = no votes). */
  diffMean: number | null
  /** Resolved differentiation bucket label, or null. */
  diffLabel: string | null
  diffVotes: number
}

export interface MatrixCategory {
  category: string
  items: MatrixItem[]
}

export interface AxisOption {
  key: string
  label: string
  value: number
}

/** Clamp plotted points inside a margin so chips near the edges stay readable. */
const INSET = 6
const SPAN = 100 - INSET * 2

/** Within-category vertical position: rank 1 (most sticky) → top. */
function stickinessY(rank: number, n: number): number {
  return n > 1 && rank > 0 ? INSET + ((rank - 1) / (n - 1)) * SPAN : 50
}

function MatrixPlot({
  items,
  options,
  stickinessName,
  differentiationName,
}: {
  items: MatrixItem[]
  options: AxisOption[]
  stickinessName: string
  differentiationName: string
}) {
  const n = items.length
  const maxVal = Math.max(1, ...options.map((o) => o.value))

  return (
    <div className="flex gap-2">
      {/* Y axis caption */}
      <div className="flex flex-col items-center justify-between py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted [writing-mode:vertical-rl] rotate-180">
          {stickinessName} →
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative w-full aspect-[4/3] rounded-lg border border-line bg-canvas overflow-hidden">
          {/* Gridlines at each differentiation option value */}
          {options.map((o) => {
            const left = INSET + (o.value / maxVal) * SPAN
            return (
              <div
                key={o.key}
                className="absolute top-0 bottom-0 border-l border-line/60"
                style={{ left: `${left}%` }}
              />
            )
          })}
          {/* Horizontal midline */}
          <div className="absolute left-0 right-0 top-1/2 border-t border-line/60" />

          {/* Points */}
          {items.map((it) => {
            const x = INSET + ((it.diffMean ?? 0) / maxVal) * SPAN
            const y = stickinessY(it.stickinessRank, n)
            return (
              <div
                key={it.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1"
                style={{ left: `${x}%`, top: `${y}%` }}
                title={`${it.title} — ${stickinessName} #${it.stickinessRank}${it.diffLabel ? `, ${differentiationName}: ${it.diffLabel}` : ''}`}
              >
                <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-ink text-white text-[11px] font-bold shadow">
                  {it.stickinessRank || '–'}
                </span>
              </div>
            )
          })}
        </div>

        {/* X axis captions at each option position */}
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
  )
}

/** Reveal for multi mode: a Stickiness × Differentiation matrix per category. */
export function MultiResultsView({
  workshopId,
  name,
  description,
  archived,
  stickinessName,
  differentiationName,
  options,
  categories,
}: {
  workshopId: string
  name: string
  description: string
  archived: boolean
  stickinessName: string
  differentiationName: string
  options: AxisOption[]
  categories: MatrixCategory[]
}) {
  const withItems = categories.filter((c) => c.items.length > 0)

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <Link href="/workshop" className="text-sm text-ink-muted hover:text-ink">← All workshops</Link>
        <header className="mt-3 mb-8">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-pass-soft border border-pass/40 text-[11px] font-bold uppercase tracking-widest text-pass mb-2">
              {archived ? 'Archived' : 'Group priorities revealed'}
            </span>
            <a
              href={`/api/workshop/sessions/${workshopId}/export`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors"
            >
              ↓ Export CSV
            </a>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-light text-ink tracking-tight">{name}</h1>
          {description && <p className="text-ink-soft mt-1">{description}</p>}
          <p className="text-sm text-ink-muted mt-3">
            Each item is plotted by <strong className="text-ink">{stickinessName}</strong> (vertical, highest at top)
            against <strong className="text-ink">{differentiationName}</strong> (horizontal). Numbers are the
            {' '}{stickinessName.toLowerCase()} rank.
          </p>
        </header>

        <div className="space-y-10">
          {categories.map((cat) => (
            <section key={cat.category}>
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">{cat.category}</h2>
              {cat.items.length === 0 ? (
                <p className="text-ink-muted text-sm py-6 text-center bg-surface rounded-lg border border-line">
                  No submissions for this category.
                </p>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <MatrixPlot
                    items={cat.items}
                    options={options}
                    stickinessName={stickinessName}
                    differentiationName={differentiationName}
                  />
                  {/* Legend list, ordered by stickiness rank */}
                  <ol className="space-y-1.5">
                    {[...cat.items]
                      .sort((a, b) => (a.stickinessRank || 999) - (b.stickinessRank || 999))
                      .map((it) => (
                        <li
                          key={it.id}
                          className="flex items-start gap-2 p-2.5 bg-surface border border-line rounded-md"
                        >
                          <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-ink text-white text-[11px] font-bold">
                            {it.stickinessRank || '–'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink leading-snug">{it.title}</p>
                            {it.diffLabel && (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                                {differentiationName}: {it.diffLabel}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                  </ol>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Combined portfolio matrix — every item, colored by category */}
        {withItems.length > 0 && (
          <section className="mt-12 pt-8 border-t border-line">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-1">All categories combined</h2>
            <p className="text-sm text-ink-muted mb-4">
              Every item on one matrix. <strong className="text-ink">{differentiationName}</strong> compares directly
              across categories; <strong className="text-ink">{stickinessName.toLowerCase()}</strong> is relative to
              each item&apos;s own category (people ranked it within categories, not across them). The top-right is
              sticky <em>and</em> {differentiationName.toLowerCase()}.
            </p>
            <CombinedMatrix
              categories={withItems}
              options={options}
              stickinessName={stickinessName}
              differentiationName={differentiationName}
            />
          </section>
        )}

        {/* Grouped into the differentiation buckets (the group's chosen label) */}
        {withItems.length > 0 && (() => {
          const allItems = withItems.flatMap((cat) => cat.items.map((it) => ({ ...it, category: cat.category })))
          // Columns run low → high to mirror the matrix X axis.
          const buckets = options.map((opt) => ({
            opt,
            items: allItems.filter((it) => it.diffLabel === opt.label),
          }))
          const topKey = options.reduce((a, b) => (b.value > a.value ? b : a), options[0])?.key
          return (
            <section className="mt-12 pt-8 border-t border-line">
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-1">
                {differentiationName} buckets
              </h2>
              <p className="text-sm text-ink-muted mb-4">
                Where the group landed each item on the {differentiationName.toLowerCase()} scale.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {buckets.map(({ opt, items }) => (
                  <div
                    key={opt.key}
                    className={`rounded-lg border p-3 ${
                      opt.key === topKey ? 'border-accent bg-accent-wash/40' : 'border-line bg-surface/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-ink">{opt.label}</h3>
                      <span className="text-xs font-semibold text-ink-muted">{items.length}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-ink-muted italic py-2">Nothing here</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {items.map((it) => (
                          <li key={`${it.category} ${it.id}`} className="p-2 bg-canvas border border-line rounded-md">
                            <p className="text-sm font-medium text-ink leading-snug">{it.title}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                              {it.category}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        })()}

        {/* Ranked purely on the differentiation scale, across all categories */}
        {withItems.length > 0 && (() => {
          const maxVal = Math.max(1, ...options.map((o) => o.value))
          const ranked = withItems
            .flatMap((cat) => cat.items.map((it) => ({ ...it, category: cat.category })))
            .sort((a, b) => (b.diffMean ?? -1) - (a.diffMean ?? -1) || a.title.localeCompare(b.title))
          return (
            <section className="mt-12 pt-8 border-t border-line">
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-1">
                Ranked by {differentiationName}
              </h2>
              <p className="text-sm text-ink-muted mb-4">
                Every item across all categories, most {differentiationName.toLowerCase()} first.
              </p>
              <ol className="space-y-1.5">
                {ranked.map((it, i) => (
                  <li
                    key={`${it.category} ${it.id}`}
                    className="flex items-center gap-3 p-2.5 bg-surface border border-line rounded-md"
                  >
                    <span className="shrink-0 w-6 text-center text-sm font-bold text-ink-soft">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-ink leading-snug">{it.title}</p>
                        <span className="px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                          {it.category}
                        </span>
                      </div>
                      {/* Scale bar: fill = mean position on the differentiation axis */}
                      <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-canvas border border-line overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${((it.diffMean ?? 0) / maxVal) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted text-right min-w-[92px]">
                      {it.diffLabel ?? '—'}
                      {it.diffMean !== null && (
                        <span className="block text-[10px] text-ink-muted/70">{it.diffMean.toFixed(1)} avg</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )
        })()}
      </div>
    </main>
  )
}
