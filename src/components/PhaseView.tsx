'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { JTBDForm } from './JTBDForm'
import { JTBDCard } from './JTBDCard'
import { VoteCard } from './VoteCard'
import { Timer } from './Timer'

interface Exercise {
  id: string
  name: string
  isActive: boolean
  currentPhase: 1 | 2 | 3
  timerEndsAt?: string | null
}

interface Entry {
  id: string
  exerciseId: string
  userId: string
  situation: string
  motivation: string
  expectedOutcome: string
  fullSentence: string
  createdAt: string
}

interface VoteData {
  totals: { entryId: string; total: number }[]
  usedVotes: number
  remainingVotes: number
  maxVotes: number
  breakdown: Record<string, number>
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

interface PhaseViewProps {
  exercise: Exercise
  userId: string
}

export function PhaseView({ exercise, userId: _userId }: PhaseViewProps) {
  const { data: entriesData, mutate: mutateEntries } = useSWR<{
    entries: Entry[]
    phase: number
  }>(`/api/exercises/${exercise.id}/entries`, fetcher, {
    refreshInterval: exercise.currentPhase === 2 ? 5000 : 10000,
  })

  const { data: voteData, mutate: mutateVotes } = useSWR<VoteData>(
    exercise.currentPhase >= 2
      ? `/api/exercises/${exercise.id}/votes`
      : null,
    fetcher,
    { refreshInterval: 5000 }
  )

  const entries = entriesData?.entries ?? []

  const handleSubmitEntry = useCallback(
    async (data: {
      situation: string
      motivation: string
      expectedOutcome: string
    }) => {
      const res = await fetch(`/api/exercises/${exercise.id}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to submit')
      }
      await mutateEntries()
    },
    [exercise.id, mutateEntries]
  )

  const handleDeleteEntry = useCallback(
    async (entryId: string) => {
      const res = await fetch(
        `/api/exercises/${exercise.id}/entries/${entryId}`,
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

  const handleVote = useCallback(
    async (entryId: string, action: 'add' | 'remove') => {
      const res = await fetch(`/api/exercises/${exercise.id}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, action }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to vote')
      }
      await mutateVotes()
    },
    [exercise.id, mutateVotes]
  )

  const totalVotesMap = new Map(
    (voteData?.totals ?? []).map((t) => [t.entryId, t.total])
  )

  const sortedEntries =
    exercise.currentPhase === 3
      ? [...entries].sort(
          (a, b) =>
            (totalVotesMap.get(b.id) ?? 0) - (totalVotesMap.get(a.id) ?? 0)
        )
      : entries

  return (
    <div className="space-y-6">
      {/* Phase header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PhaseBadge phase={exercise.currentPhase} />
          {exercise.timerEndsAt && (
            <Timer endsAt={exercise.timerEndsAt} />
          )}
        </div>
        <div className="text-sm text-ink-3">
          {exercise.name}
        </div>
      </div>

      {/* Phase 1: Creation */}
      {exercise.currentPhase === 1 && (
        <div className="space-y-6">
          <JTBDForm
            exerciseId={exercise.id}
            onSubmit={handleSubmitEntry}
          />

          {entries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink mb-3">
                Your statements ({entries.length})
              </h3>
              <div className="space-y-3">
                {entries.map((entry) => (
                  <JTBDCard
                    key={entry.id}
                    {...entry}
                    onDelete={handleDeleteEntry}
                    showDelete
                  />
                ))}
              </div>
            </div>
          )}

          {entries.length === 0 && (
            <div className="text-center py-10 text-ink-3">
              <div className="text-3xl mb-2">✍️</div>
              <p className="text-sm">Your submitted statements will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Phase 2: Voting */}
      {exercise.currentPhase === 2 && (
        <div className="space-y-5">
          {voteData && (
            <div className="bg-surface rounded-[14px] border border-warm-border p-4" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ink">
                      {voteData.maxVotes}
                    </div>
                    <div className="text-xs text-ink-3 mt-0.5">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ink">
                      {voteData.usedVotes}
                    </div>
                    <div className="text-xs text-ink-3 mt-0.5">Used</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ink">
                      {voteData.remainingVotes}
                    </div>
                    <div className="text-xs text-ink-3 mt-0.5">Remaining</div>
                  </div>
                </div>
                <div className="w-32">
                  <div className="flex justify-between text-xs text-ink-3 mb-1.5">
                    <span>Progress</span>
                    <span>{voteData.usedVotes}/{voteData.maxVotes}</span>
                  </div>
                  <div className="h-1.5 bg-canvas rounded-full overflow-hidden border border-warm-border">
                    <div
                      className="h-full bg-ink rounded-full transition-all"
                      style={{ width: `${(voteData.usedVotes / voteData.maxVotes) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {sortedEntries.map((entry) => (
              <VoteCard
                key={entry.id}
                id={entry.id}
                situation={entry.situation}
                motivation={entry.motivation}
                expectedOutcome={entry.expectedOutcome}
                totalVotes={totalVotesMap.get(entry.id) ?? 0}
                myVotes={voteData?.breakdown[entry.id] ?? 0}
                remainingVotes={voteData?.remainingVotes ?? 0}
                onVote={handleVote}
                disabled={!voteData}
              />
            ))}
          </div>

          {entries.length === 0 && (
            <div className="text-center py-10 text-ink-3">
              <div className="text-3xl mb-2">🗳️</div>
              <p className="text-sm">No entries to vote on yet</p>
            </div>
          )}
        </div>
      )}

      {/* Phase 3: Discussion */}
      {exercise.currentPhase === 3 && (
        <div className="space-y-5">
          <div className="bg-sand rounded-[14px] border border-warm-border p-4 text-sm text-ink">
            <strong>Discussion phase:</strong> Cards are sorted by votes. Use these to guide your conversation.
          </div>

          <div className="space-y-3">
            {sortedEntries.map((entry, i) => (
              <VoteCard
                key={entry.id}
                id={entry.id}
                situation={entry.situation}
                motivation={entry.motivation}
                expectedOutcome={entry.expectedOutcome}
                totalVotes={totalVotesMap.get(entry.id) ?? 0}
                myVotes={0}
                remainingVotes={0}
                onVote={async () => {}}
                disabled
                discussionMode
                rank={i + 1}
              />
            ))}
          </div>

          {entries.length === 0 && (
            <div className="text-center py-10 text-ink-3">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-sm">No entries yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PhaseBadge({ phase }: { phase: 1 | 2 | 3 }) {
  const labels = {
    1: 'Phase 1: Creation',
    2: 'Phase 2: Voting',
    3: 'Phase 3: Discussion',
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sand text-ink border border-warm-border">
      <span className="w-1.5 h-1.5 rounded-full bg-ink opacity-50" />
      {labels[phase]}
    </span>
  )
}
