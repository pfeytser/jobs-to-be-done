'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Timer } from './Timer'

interface ClusterCard {
  label: string
  count: number
  terms: string[]
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
  timerEndsAt?: string | null
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

interface SentimentBrainstormViewProps {
  exercise: Exercise
}

export function SentimentBrainstormView({ exercise }: SentimentBrainstormViewProps) {
  const { data, mutate } = useSWR<{ cards: ClusterCard[] }>(
    `/api/exercises/${exercise.id}/sentiment-brainstorm`,
    fetcher,
    { refreshInterval: 5000 }
  )

  const [modalCard, setModalCard] = useState<ClusterCard | null>(null)

  const cards = data?.cards ?? []

  return (
    <div className="space-y-6">
      {/* Phase header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sand text-ink border border-warm-border">
            <span className="w-1.5 h-1.5 rounded-full bg-ink opacity-50" />
            Phase 3: Brainstorming
          </span>
          {exercise.timerEndsAt && <Timer endsAt={exercise.timerEndsAt} />}
        </div>
        <div className="text-sm text-ink-3">{exercise.name}</div>
      </div>

      {cards.length === 0 && (
        <div className="text-center py-16 text-ink-3">
          <div className="flex justify-center mb-3">
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm">Loading clusters…</p>
        </div>
      )}

      {cards.length > 0 && (
        <div className="space-y-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="bg-surface rounded-[14px] border border-warm-border overflow-hidden"
              style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}
            >
              {/* Cluster header */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-ink">{card.label}</p>
                  <span className="text-xs text-ink-3">
                    {card.count} {card.count === 1 ? 'word' : 'words'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {card.terms.map((term) => (
                    <span
                      key={term}
                      className="px-2.5 py-1 bg-sand rounded-full text-xs text-ink-2 border border-warm-border"
                    >
                      {term}
                    </span>
                  ))}
                </div>
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

              {/* Add idea button */}
              <div className="px-5 pb-5">
                <button
                  onClick={() => setModalCard(card)}
                  className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink font-medium transition-colors group"
                >
                  <span className="w-6 h-6 rounded-full border border-warm-border bg-canvas flex items-center justify-center group-hover:bg-ink group-hover:border-ink group-hover:text-white transition-all text-base leading-none">
                    +
                  </span>
                  What feature could evoke this feeling?
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Solution modal */}
      {modalCard && (
        <SentimentSolutionModal
          exerciseId={exercise.id}
          clusterLabel={modalCard.label}
          terms={modalCard.terms}
          onClose={() => setModalCard(null)}
          onSubmitted={() => mutate()}
        />
      )}
    </div>
  )
}

function SentimentSolutionModal({
  exerciseId,
  clusterLabel,
  terms,
  onClose,
  onSubmitted,
}: {
  exerciseId: string
  clusterLabel: string
  terms: string[]
  onClose: () => void
  onSubmitted: () => void
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/exercises/${exerciseId}/sentiment-brainstorm/${encodeURIComponent(clusterLabel)}/solutions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim() }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to submit')
      }
      onSubmitted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(17,34,32,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-surface rounded-[14px] border border-warm-border w-full max-w-lg shadow-xl"
        style={{ boxShadow: '0 8px 32px rgba(17,34,32,0.18)' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-warm-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-1">
                Add a feature idea
              </p>
              <p className="text-sm font-medium text-ink leading-snug">{clusterLabel}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 text-ink-3 hover:text-ink transition-colors rounded-lg hover:bg-canvas"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {terms.slice(0, 8).map((term) => (
              <span key={term} className="px-2 py-0.5 bg-canvas rounded-full text-xs text-ink-2 border border-warm-border">
                {term}
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              What feature could evoke this feeling?
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. A celebratory animation when someone completes a goal…"
              className="w-full px-4 py-3 border border-warm-border rounded-[14px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition-all resize-none"
              rows={4}
              maxLength={1000}
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-[14px] text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-canvas border border-warm-border text-ink-2 text-sm font-medium rounded-full hover:border-ink hover:text-ink transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                'Add Idea'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
