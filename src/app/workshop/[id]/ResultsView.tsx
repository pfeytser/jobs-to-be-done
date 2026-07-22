import Link from 'next/link'

export interface ResultRow {
  rank: number
  score: number
  title: string
  description: string
  category: string
}

export interface CategoryResult {
  category: string
  rows: ResultRow[]
}

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`
}

/** Read-only reveal: the group's aggregate combined ranking, then each category. */
export function ResultsView({
  name,
  description,
  combined,
  categories,
  archived,
}: {
  name: string
  description: string
  combined: ResultRow[]
  categories: CategoryResult[]
  archived: boolean
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
        </header>

        {/* Combined — the headline result */}
        <section className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">🏆 Top group priorities</h2>
          {combined.length === 0 ? (
            <p className="text-ink-muted text-sm py-6 text-center bg-surface rounded-lg border border-line">
              No combined ranking was submitted.
            </p>
          ) : (
            <ol className="space-y-2">
              {combined.map((row) => (
                <li
                  key={`${row.category}-${row.title}-${row.rank}`}
                  className={`flex items-start gap-4 p-4 rounded-lg border ${
                    row.rank <= 3 ? 'bg-surface border-ink/30' : 'bg-surface/60 border-line'
                  }`}
                >
                  <span className="shrink-0 w-8 text-center text-lg font-bold text-ink">{medal(row.rank)}</span>
                  <div className="min-w-0 flex-1">
                    <span className="inline-block mb-1 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                      {row.category}
                    </span>
                    <p className="text-base font-semibold text-ink leading-snug">{row.title}</p>
                    {row.description && <p className="text-sm text-ink-muted mt-0.5">{row.description}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted mt-1">{row.score} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Per-category aggregates */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-4">By category</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div key={cat.category}>
                <h3 className="text-sm font-bold text-ink mb-2">{cat.category}</h3>
                <ol className="space-y-1.5">
                  {cat.rows.map((row) => (
                    <li
                      key={`${row.title}-${row.rank}`}
                      className="flex items-start gap-2 p-2.5 bg-surface border border-line rounded-md"
                    >
                      <span className="shrink-0 w-5 text-center text-xs font-bold text-ink-soft">{row.rank}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink leading-snug">{row.title}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-ink-muted">{row.score}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
