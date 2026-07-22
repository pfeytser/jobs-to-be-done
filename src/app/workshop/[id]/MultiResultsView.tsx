import Link from 'next/link'

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
            const y = n > 1 && it.stickinessRank > 0 ? INSET + ((it.stickinessRank - 1) / (n - 1)) * SPAN : 50
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
  name,
  description,
  archived,
  stickinessName,
  differentiationName,
  options,
  categories,
}: {
  name: string
  description: string
  archived: boolean
  stickinessName: string
  differentiationName: string
  options: AxisOption[]
  categories: MatrixCategory[]
}) {
  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <Link href="/workshop" className="text-sm text-ink-muted hover:text-ink">← All workshops</Link>
        <header className="mt-3 mb-8">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-pass-soft border border-pass/40 text-[11px] font-bold uppercase tracking-widest text-pass mb-2">
            {archived ? 'Archived' : 'Group priorities revealed'}
          </span>
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
      </div>
    </main>
  )
}
