'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { SentimentForm } from './SentimentForm'
import { SentimentCard } from './SentimentCard'
import { SentimentAnalysis } from './SentimentAnalysis'
import { SentimentBrainstormView } from './SentimentBrainstormView'
import { Timer } from './Timer'

interface SentimentCluster {
  label: string
  count: number
  terms: string[]
}

interface SentimentAnalysisResult {
  brandFeelingStatement: string
  brandFeelingExplanation: string
  clusters: SentimentCluster[]
}

interface Exercise {
  id: string
  name: string
  mainPrompt?: string | null
  isActive: boolean
  currentPhase: 1 | 2 | 3 | 4 | 5
  timerEndsAt?: string | null
  type: 'jtbd' | 'sentiment'
  sentimentAnalysis?: SentimentAnalysisResult | null
}

interface SentimentEntryItem {
  id: string
  term: string
  isOwn: boolean
  createdAt: string
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

interface SentimentViewProps {
  exercise: Exercise
}

export function SentimentView({ exercise }: SentimentViewProps) {
  const { data: entriesData, mutate: mutateEntries } = useSWR<{
    entries: SentimentEntryItem[]
  }>(`/api/exercises/${exercise.id}/sentiment-entries`, fetcher, {
    refreshInterval: 5000,
  })

  // Poll the exercise to detect when analysis is ready or phase changes
  const { data: exerciseData } = useSWR<{ exercise: Exercise }>(
    exercise.currentPhase >= 2 ? `/api/exercises/${exercise.id}` : null,
    fetcher,
    { refreshInterval: 3000 }
  )

  const liveExercise = exerciseData?.exercise ?? exercise
  const entries = entriesData?.entries ?? []

  const handleSubmit = useCallback(
    async (term: string) => {
      const res = await fetch(`/api/exercises/${exercise.id}/sentiment-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to submit')
      }
      await mutateEntries()
    },
    [exercise.id, mutateEntries]
  )

  const handleDelete = useCallback(
    async (entryId: string) => {
      const res = await fetch(
        `/api/exercises/${exercise.id}/sentiment-entries/${entryId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to delete')
      }
      await mutateEntries()
    },
    [exercise.id, mutateEntries]
  )

  // Phase 3: Brainstorming — render directly, no outer header
  if (liveExercise.currentPhase === 3) {
    return <SentimentBrainstormView exercise={liveExercise} />
  }

  return (
    <div className="space-y-6">
      {/* Phase header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PhaseBadge phase={liveExercise.currentPhase} />
          {exercise.timerEndsAt && <Timer endsAt={exercise.timerEndsAt} />}
        </div>
        <div className="text-sm text-ink-3">{exercise.name}</div>
      </div>

      {/* Phase 1: Creation */}
      {liveExercise.currentPhase === 1 && (
        <div className="space-y-5">
          <SentimentForm onSubmit={handleSubmit} />

          {entries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink mb-3">
                Your responses ({entries.length})
              </h3>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <SentimentCard
                    key={entry.id}
                    id={entry.id}
                    term={entry.term}
                    isOwn={entry.isOwn}
                    onDelete={entry.isOwn ? handleDelete : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {entries.length === 0 && (
            <div className="text-center py-10 text-ink-3">
              <div className="text-3xl mb-2">✍️</div>
              <p className="text-sm">Your responses will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Phase 2: Analysis */}
      {liveExercise.currentPhase === 2 && (
        <div>
          {liveExercise.sentimentAnalysis ? (
            <SentimentAnalysis analysis={liveExercise.sentimentAnalysis} />
          ) : (
            <div className="text-center py-20 space-y-4">
              <div className="flex justify-center">
                <svg className="w-8 h-8 animate-spin text-ink-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-ink">Generating your analysis…</p>
              <p className="text-xs text-ink-3">Your facilitator is synthesizing the responses</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PhaseBadge({ phase }: { phase: 1 | 2 | 3 | 4 | 5 }) {
  const labels: Record<number, string> = {
    1: 'Phase 1: Creation',
    2: 'Phase 2: Analysis',
    3: 'Phase 3: Brainstorming',
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sand text-ink border border-warm-border">
      <span className="w-1.5 h-1.5 rounded-full bg-ink opacity-50" />
      {labels[phase] ?? `Phase ${phase}`}
    </span>
  )
}
