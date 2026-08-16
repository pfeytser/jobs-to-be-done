'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  QUADRANT_KEYS,
  QUADRANT_MEANING,
  type AxisLabels,
  type DecidedTheme,
  type DecisionLogEntry,
  type QuadrantKey,
} from '@/lib/quadrant-model'
import { QuadrantFrame } from './QuadrantFrame'
import { DecidedBoard } from './DecidedBoard'

export interface RevealTheme {
  id: string
  title: string
  items: string[]
  votesByQuadrant: Record<QuadrantKey, number>
  totalVotes: number
  consensusQuadrant: QuadrantKey | null
  tie: boolean
  agreementScore: number
  distinctQuadrants: number
  contested: boolean
  /** Admin-only; null for participants. */
  facilitatorReference: QuadrantKey | null
}

export interface NamedPlacementVM {
  displayName: string
  quadrantKey: QuadrantKey | null
}

/** The quadrant a theme sits in on the consensus grid (top-voted; first on ties). */
function gridQuadrant(t: RevealTheme): QuadrantKey | null {
  if (t.totalVotes === 0) return null
  let best: QuadrantKey | null = null
  let bestV = 0
  for (const k of QUADRANT_KEYS) {
    if (t.votesByQuadrant[k] > bestV) {
      bestV = t.votesByQuadrant[k]
      best = k
    }
  }
  return best
}

function ConsensusChip({ t }: { t: RevealTheme }) {
  const [open, setOpen] = useState(false)
  const hasItems = t.items.length > 0
  return (
    <div className="bg-surface border border-line rounded-md">
      <button
        onClick={() => hasItems && setOpen((o) => !o)}
        aria-expanded={hasItems ? open : undefined}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-left ${hasItems ? '' : 'cursor-default'}`}
      >
        <span className="min-w-0 flex-1 text-[11px] sm:text-xs font-medium text-ink leading-tight truncate">
          {t.title}
        </span>
        {t.contested && (
          <span
            title="Contested — the group was split"
            className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-blocked bg-blocked-soft border border-blocked-line rounded-full px-1.5 py-0.5"
          >
            {t.tie ? 'Tie' : 'Split'}
          </span>
        )}
        {hasItems && <span className="shrink-0 text-[10px] text-ink-muted">{open ? '−' : '+'}</span>}
      </button>
      {open && hasItems && (
        <ul className="px-2.5 pb-1.5 pt-0.5 list-disc list-inside space-y-0.5">
          {t.items.map((it, i) => (
            <li key={i} className="text-[10px] text-ink-soft leading-snug">
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function VoteBars({
  t,
  quadrantLabels,
}: {
  t: RevealTheme
  quadrantLabels: Record<QuadrantKey, string>
}) {
  const consensus = gridQuadrant(t)
  return (
    <div className="space-y-1.5">
      {QUADRANT_KEYS.map((k) => {
        const v = t.votesByQuadrant[k]
        const pct = t.totalVotes > 0 ? Math.round((v / t.totalVotes) * 100) : 0
        const isConsensus = k === consensus
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="w-32 sm:w-40 shrink-0 text-[11px] text-ink-soft leading-tight text-right">
              {quadrantLabels[k]}
            </span>
            <div className="flex-1 h-4 bg-canvas border border-line rounded overflow-hidden">
              <div
                className={isConsensus ? 'h-full bg-ink' : 'h-full bg-accent'}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-[11px] text-ink-muted tabular-nums">{v}</span>
          </div>
        )
      })}
    </div>
  )
}

function ThemeDetail({
  t,
  rank,
  quadrantLabels,
  breakdown,
  isAdmin,
}: {
  t: RevealTheme
  rank: number
  quadrantLabels: Record<QuadrantKey, string>
  breakdown?: NamedPlacementVM[]
  isAdmin: boolean
}) {
  const [open, setOpen] = useState(false)
  const consensus = gridQuadrant(t)

  return (
    <div className="border border-line rounded-lg bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-3 text-left">
        <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-canvas border border-line text-xs font-bold text-ink-soft">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink leading-snug">{t.title}</p>
          <p className="text-[11px] text-ink-muted mt-0.5">
            {t.totalVotes === 0
              ? 'No votes'
              : `${Math.round(t.agreementScore * 100)}% agreement · ${t.distinctQuadrants} of 4 quadrants`}
          </p>
        </div>
        {t.contested && (
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-blocked bg-blocked-soft border border-blocked-line rounded-full px-1.5 py-0.5">
            {t.tie ? 'Tie' : 'Split'}
          </span>
        )}
        <span className="shrink-0 text-xs text-ink-muted">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-line space-y-3">
          {t.items.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {t.items.map((it, i) => (
                <li key={i} className="text-[11px] text-ink-soft bg-canvas border border-line rounded-full px-2 py-0.5">
                  {it}
                </li>
              ))}
            </ul>
          )}

          <VoteBars t={t} quadrantLabels={quadrantLabels} />

          {isAdmin && breakdown && breakdown.length > 0 && (
            <div className="pt-2 border-t border-line">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
                Who placed it where
              </p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {breakdown.map((b, i) => {
                  const differs = consensus !== null && b.quadrantKey !== consensus
                  return (
                    <li key={i} className="text-[11px] text-ink-soft flex items-center gap-1.5">
                      <span className="font-medium text-ink">{b.displayName}</span>
                      <span className="text-ink-muted">→</span>
                      <span className={differs ? 'text-blocked font-medium' : 'text-ink-soft'}>
                        {b.quadrantKey ? quadrantLabels[b.quadrantKey] : '—'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {isAdmin && t.facilitatorReference && (
            <p className="text-[11px] text-ink-muted pt-1">
              Facilitator reference:{' '}
              <span className="font-medium text-ink-soft">{quadrantLabels[t.facilitatorReference]}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Freezes the vote in amber and seeds the decided board from it. One-way and
 * facilitator-only: from here on the decided board is the living state, and the
 * voted result is a snapshot that never changes again.
 */
function StartDecisions({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quadrant/projects/${projectId}/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'freeze' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not start decisions')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start decisions')
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-lg border border-accent/50 bg-accent/10 p-4">
      <p className="text-sm font-semibold text-ink">Discussion changed something?</p>
      <p className="text-xs text-ink-soft mt-1">
        Freeze this result and start a decided board seeded from the consensus above. The vote stays exactly as it is
        — you then move themes, re-scope them, and add what came out of the conversation.
      </p>
      {error && <p className="text-xs text-fail mt-2">{error}</p>}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {confirming ? (
          <>
            <button
              onClick={start}
              disabled={busy}
              className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40"
            >
              {busy ? 'Freezing…' : 'Yes, freeze & start'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="px-4 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink"
            >
              Not yet
            </button>
            <span className="text-xs text-ink-muted">Freezing can&apos;t be undone.</span>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90"
          >
            Freeze &amp; start decisions →
          </button>
        )}
      </div>
    </div>
  )
}

export function RevealView({
  projectId,
  name,
  axisLabels,
  themes,
  disagreement,
  breakdown,
  isAdmin,
  canManage,
  frozenAt,
  decided,
  decisionLog,
  votedQuadrantByThemeId,
}: {
  projectId: string
  name: string
  axisLabels: AxisLabels
  themes: RevealTheme[]
  disagreement: RevealTheme[]
  breakdown?: Record<string, NamedPlacementVM[]>
  isAdmin: boolean
  canManage: boolean
  /** Set once the vote was frozen and the decided board seeded. */
  frozenAt: string | null
  decided: DecidedTheme[]
  decisionLog: DecisionLogEntry[]
  votedQuadrantByThemeId: Record<string, QuadrantKey | null>
}) {
  const quadrantLabels = axisLabels.quadrants
  // Once frozen, the decided board is what the team is actually working from.
  const [tab, setTab] = useState<'voted' | 'decided'>(frozenAt ? 'decided' : 'voted')
  const noVotes = themes.filter((t) => t.totalVotes === 0)
  const totalPlaced = themes.reduce((s, t) => s + t.totalVotes, 0)
  // Only themes with an actual split (voters chose 2+ different quadrants) belong
  // on the debate agenda; unanimous and unvoted themes have nothing to discuss.
  const debatable = disagreement.filter((t) => t.totalVotes > 0 && t.distinctQuadrants >= 2)

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <a href="/quadrant" className="text-sm text-ink-muted hover:text-ink">
          ← All projects
        </a>
        <header className="mt-3 mb-6">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-pass-soft text-pass text-[11px] font-bold uppercase tracking-widest mb-2">
            Revealed
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-light text-ink tracking-tight">{name}</h1>
          <p className="text-ink-soft mt-1">
            {frozenAt
              ? 'The vote is frozen. The decided board is where it stands after the discussion.'
              : 'Where the group landed on each theme, and what it’s most split on.'}
          </p>
        </header>

        {frozenAt && (
          <div className="mb-6 inline-flex rounded-lg border border-line bg-surface p-0.5">
            {(
              [
                ['voted', 'As voted'],
                ['decided', 'Decided'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  tab === key ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {frozenAt && tab === 'decided' ? (
          <DecidedBoard
            projectId={projectId}
            axisLabels={axisLabels}
            initialThemes={decided}
            votedQuadrantByThemeId={votedQuadrantByThemeId}
            log={decisionLog}
            canManage={canManage}
            frozenAt={frozenAt}
          />
        ) : totalPlaced === 0 ? (
          <div className="p-8 bg-surface border border-line rounded-lg text-center text-ink-muted">
            No placements were made before the reveal.
          </div>
        ) : (
          <div className="space-y-10">
            {canManage && !frozenAt && <StartDecisions projectId={projectId} />}

            {/* Group consensus grid */}
            <section>
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted">Group consensus</h2>
                {frozenAt && (
                  <span className="text-[11px] text-ink-muted">
                    Frozen {new Date(frozenAt).toLocaleString()} — this view never changes again
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 sm:p-5">
                <QuadrantFrame
                  axisLabels={axisLabels}
                  renderQuadrant={(key) => {
                    const here = themes.filter((t) => gridQuadrant(t) === key)
                    return (
                      <div className="h-full min-h-[120px] sm:min-h-[160px] rounded-lg border border-line bg-canvas p-2.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold uppercase tracking-wide text-ink leading-tight">
                            {quadrantLabels[key]}
                          </span>
                          {here.length > 0 && <span className="text-[10px] text-ink-muted">{here.length}</span>}
                        </div>
                        <p className="text-[10px] text-ink-muted leading-snug mt-0.5 mb-2">{QUADRANT_MEANING[key]}</p>
                        <div className="space-y-1">
                          {here.map((t) => (
                            <ConsensusChip key={t.id} t={t} />
                          ))}
                        </div>
                      </div>
                    )
                  }}
                />
              </div>
              {noVotes.length > 0 && (
                <p className="text-xs text-ink-muted mt-2">
                  No votes yet: {noVotes.map((t) => t.title).join(', ')}
                </p>
              )}
            </section>

            {/* Disagreement ranking + per-theme detail — only themes where the
                group actually split (placed in 2+ different quadrants). */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-1">Debate agenda</h2>
              {debatable.length > 0 ? (
                <>
                  <p className="text-xs text-ink-muted mb-4">
                    Most contested first — expand any theme for the full vote breakdown
                    {isAdmin ? ' and who placed it where' : ''}.
                  </p>
                  <div className="space-y-2">
                    {debatable.map((t, i) => (
                      <ThemeDetail
                        key={t.id}
                        t={t}
                        rank={i + 1}
                        quadrantLabels={quadrantLabels}
                        breakdown={breakdown?.[t.id]}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-muted py-6 text-center bg-surface rounded-lg border border-line">
                  No disagreements — the group placed every theme in a single quadrant.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
