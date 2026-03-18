'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { SolutionModal } from './SolutionModal'
import { Timer } from './Timer'

interface BrainstormCard {
  entryId: string
  fullSentence: string
  situation: string
  motivation: string
  expectedOutcome: string
  problemStatement: string | null
  solutions: {
    id: string
    text: string
    userName: string | null
    createdAt: string
  }[]
}

interface Exercise {
  id: string
  name: string
  currentPhase: 1 | 2 | 3 | 4 | 5
  timerEndsAt?: string | null
  jtbdMode: 'classic' | 'hiring'
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

interface BrainstormViewProps {
  exercise: Exercise
}

export function BrainstormView({ exercise }: BrainstormViewProps) {
  const { data, mutate } = useSWR<{ cards: BrainstormCard[] }>(
    `/api/exercises/${exercise.id}/brainstorm`,
    fetcher,
    { refreshInterval: 5000 }
  )

  const [modalEntry, setModalEntry] = useState<BrainstormCard | null>(null)

  const cards = data?.cards ?? []
  const allGenerated = cards.length > 0 && cards.every((c) => c.problemStatement !== null)
  const anyGenerated = cards.some((c) => c.problemStatement !== null)

  // Track how long we've been waiting with no problem statements
  const [stuckSeconds, setStuckSeconds] = useState(0)
  const isStuck = !anyGenerated && cards.length > 0

  useEffect(() => {
    if (!isStuck) {
      setStuckSeconds(0)
      return
    }
    const interval = setInterval(() => setStuckSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [isStuck])

  return (
    <div className="space-y-6">
      {/* Phase header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sand text-ink border border-warm-border">
            <span className="w-1.5 h-1.5 rounded-full bg-ink opacity-50" />
            Phase 4: Brainstorming
          </span>
          {exercise.timerEndsAt && <Timer endsAt={exercise.timerEndsAt} />}
        </div>
        <div className="text-sm text-ink-3">{exercise.name}</div>
      </div>

      {/* Loading state — waiting for problem statements */}
      {!anyGenerated && cards.length > 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="flex justify-center">
            <svg className="w-7 h-7 animate-spin text-ink-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-ink">Generating problem statements…</p>
          {stuckSeconds >= 20 ? (
            <p className="text-xs text-ink-3">
              Taking longer than expected — ask your facilitator to click <strong>Regenerate problem statements</strong> in the admin panel.
            </p>
          ) : (
            <p className="text-xs text-ink-3">Your facilitator is setting up the brainstorm</p>
          )}
        </div>
      )}

      {!anyGenerated && cards.length === 0 && (
        <div className="text-center py-16 text-ink-3">
          <p className="text-sm">Setting up brainstorm…</p>
        </div>
      )}

      {/* Cards */}
      {anyGenerated && (
        <div className="space-y-4">
          {!allGenerated && (
            <div className="flex items-center gap-2 text-xs text-ink-3 px-1">
              <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating remaining problem statements…
            </div>
          )}

          {cards.map((card) => (
            <div
              key={card.entryId}
              className="bg-surface rounded-[14px] border border-warm-border overflow-hidden"
              style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}
            >
              {/* Statement */}
              <div className="px-5 pt-5 pb-4">
                <p className="text-sm font-semibold text-ink leading-relaxed">
                  {card.fullSentence}
                </p>

                {card.problemStatement ? (
                  <p className="mt-2 text-sm text-ink-2 leading-relaxed italic">
                    {card.problemStatement}
                  </p>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating problem statement…
                  </div>
                )}
              </div>

              {/* Solutions */}
              {card.solutions.length > 0 && (
                <div className="px-5 pb-3 space-y-2">
                  <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
                    Feature ideas ({card.solutions.length})
                  </p>
                  {card.solutions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-2.5 px-3 py-2.5 bg-canvas rounded-[10px] border border-warm-border"
                    >
                      <div className="w-5 h-5 rounded-full bg-sand border border-warm-border flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-ink-2">
                          {(s.userName ?? '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink leading-relaxed">{s.text}</p>
                        {s.userName && (
                          <p className="text-xs text-ink-3 mt-0.5">{s.userName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add solution button */}
              <div className="px-5 pb-5">
                <button
                  onClick={() => setModalEntry(card)}
                  className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink font-medium transition-colors group"
                >
                  <span className="w-6 h-6 rounded-full border border-warm-border bg-canvas flex items-center justify-center group-hover:bg-ink group-hover:border-ink group-hover:text-white transition-all text-base leading-none">
                    +
                  </span>
                  What feature could solve this?
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Solution modal */}
      {modalEntry && (
        <SolutionModal
          exerciseId={exercise.id}
          entryId={modalEntry.entryId}
          statementPreview={modalEntry.fullSentence}
          problemStatement={modalEntry.problemStatement}
          onClose={() => setModalEntry(null)}
          onSubmitted={() => mutate()}
        />
      )}
    </div>
  )
}
