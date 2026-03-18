'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { JTBDForm } from './JTBDForm'
import { JTBDCard } from './JTBDCard'
import { VoteCard } from './VoteCard'
import { Timer } from './Timer'
import { SentimentView } from './SentimentView'
import { BrainstormView } from './BrainstormView'
import { DiscussionInsights } from './DiscussionInsights'
import { SynthesisView } from './SynthesisView'

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

interface DeduplicationGroup {
  canonicalId: string
  supportingIds: string[]
}

interface JTBDDiscussionTension {
  concept1: string
  concept2: string
  description: string
}

interface JTBDDiscussionAnalysis {
  commonalities: string[]
  tensions: JTBDDiscussionTension[]
}

interface Exercise {
  id: string
  name: string
  isActive: boolean
  currentPhase: 1 | 2 | 3 | 4 | 5
  timerEndsAt?: string | null
  type: 'jtbd' | 'sentiment'
  jtbdMode: 'classic' | 'hiring'
  sentimentAnalysis?: SentimentAnalysisResult | null
  jtbdDeduplication?: { groups: DeduplicationGroup[] } | null
  jtbdDiscussionAnalysis?: JTBDDiscussionAnalysis | null
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
  isAdmin?: boolean
}

export function PhaseView({ exercise, userId, isAdmin = false }: PhaseViewProps) {
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

  const [showAll, setShowAll] = useState(false)
  const [deduplication, setDeduplication] = useState(exercise.jtbdDeduplication ?? null)

  const handleBreakOut = useCallback(
    async (entryId: string) => {
      const res = await fetch(`/api/exercises/${exercise.id}/deduplicate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'break-out', entryId }),
      })
      if (!res.ok) return
      const { deduplication: updated } = await res.json()
      setDeduplication(updated)
    },
    [exercise.id]
  )

  const handleMove = useCallback(
    async (entryId: string, targetCanonicalId: string) => {
      const res = await fetch(`/api/exercises/${exercise.id}/deduplicate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', entryId, targetCanonicalId }),
      })
      if (!res.ok) return
      const { deduplication: updated } = await res.json()
      setDeduplication(updated)
    },
    [exercise.id]
  )

  const allEntries = entriesData?.entries ?? []
  const entries = isAdmin && exercise.currentPhase === 1 && !showAll
    ? allEntries.filter((e) => e.userId === userId)
    : allEntries

  const handleSubmitEntry = useCallback(
    async (data: Record<string, string>) => {
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

  const entryMap = new Map(allEntries.map((e) => [e.id, e]))

  const dedupeGroups = deduplication?.groups ?? null

  // For Phase 3, sort groups by canonical entry's vote count descending
  const sortedDedupeGroups =
    dedupeGroups && exercise.currentPhase === 3
      ? [...dedupeGroups].sort(
          (a, b) =>
            (totalVotesMap.get(b.canonicalId) ?? 0) -
            (totalVotesMap.get(a.canonicalId) ?? 0)
        )
      : dedupeGroups

  if (exercise.type === 'sentiment') {
    return <SentimentView exercise={exercise} />
  }

  if (exercise.currentPhase === 4) {
    return <BrainstormView exercise={exercise} />
  }

  if (exercise.currentPhase === 5) {
    return <SynthesisView exercise={exercise} isAdmin={isAdmin} />
  }

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
            mode={exercise.jtbdMode}
            onSubmit={handleSubmitEntry}
          />

          {(entries.length > 0 || (isAdmin && allEntries.length > 0)) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink">
                  {isAdmin && showAll
                    ? `All statements (${allEntries.length})`
                    : `Your statements (${entries.length})`}
                </h3>
                {isAdmin && (
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                      showAll
                        ? 'bg-ink text-white border-ink'
                        : 'bg-canvas text-ink-2 border-warm-border hover:border-ink hover:text-ink'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                        showAll ? 'border-white' : 'border-ink-3'
                      }`}
                    >
                      {showAll && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                    </span>
                    Display all statements
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {entries.map((entry) => (
                  <JTBDCard
                    key={entry.id}
                    {...entry}
                    mode={exercise.jtbdMode}
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

          {dedupeGroups ? (
            <div className="space-y-3">
              {dedupeGroups.map((group) => {
                const canonical = entryMap.get(group.canonicalId)
                if (!canonical) return null
                const supporting = group.supportingIds
                  .map((id) => entryMap.get(id))
                  .filter((e): e is Entry => !!e)
                const otherCanonicals = (dedupeGroups ?? [])
                  .filter((g) => g.canonicalId !== group.canonicalId)
                  .map((g) => entryMap.get(g.canonicalId))
                  .filter((e): e is Entry => !!e)
                return (
                  <div key={group.canonicalId}>
                    <VoteCard
                      id={canonical.id}
                      situation={canonical.situation}
                      motivation={canonical.motivation}
                      expectedOutcome={canonical.expectedOutcome}
                      fullSentence={canonical.fullSentence}
                      mode={exercise.jtbdMode}
                      totalVotes={totalVotesMap.get(canonical.id) ?? 0}
                      myVotes={voteData?.breakdown[canonical.id] ?? 0}
                      remainingVotes={voteData?.remainingVotes ?? 0}
                      onVote={handleVote}
                      disabled={!voteData}
                    />
                    {supporting.length > 0 && (
                      <SupportingAccordion
                        entries={supporting}
                        mode={exercise.jtbdMode}
                        canonicalEntries={otherCanonicals}
                        onBreakOut={handleBreakOut}
                        onMove={handleMove}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-ink-3">
              <svg className="w-5 h-5 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm">Consolidating entries…</p>
            </div>
          )}

          {dedupeGroups && dedupeGroups.length === 0 && (
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
          <DiscussionInsights
            exerciseId={exercise.id}
            initialAnalysis={exercise.jtbdDiscussionAnalysis}
          />

          <div className="bg-sand rounded-[14px] border border-warm-border p-4 text-sm text-ink">
            <strong>Discussion phase:</strong> Cards are sorted by votes. Use these to guide your conversation.
          </div>

          {sortedDedupeGroups ? (
            <div className="space-y-3">
              {sortedDedupeGroups.map((group, i) => {
                const canonical = entryMap.get(group.canonicalId)
                if (!canonical) return null
                const supporting = group.supportingIds
                  .map((id) => entryMap.get(id))
                  .filter((e): e is Entry => !!e)
                return (
                  <div key={group.canonicalId}>
                    <VoteCard
                      id={canonical.id}
                      situation={canonical.situation}
                      motivation={canonical.motivation}
                      expectedOutcome={canonical.expectedOutcome}
                      fullSentence={canonical.fullSentence}
                      mode={exercise.jtbdMode}
                      totalVotes={totalVotesMap.get(canonical.id) ?? 0}
                      myVotes={0}
                      remainingVotes={0}
                      onVote={async () => {}}
                      disabled
                      discussionMode
                      rank={i + 1}
                    />
                    {supporting.length > 0 && (
                      <SupportingAccordion entries={supporting} mode={exercise.jtbdMode} />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedEntries.map((entry, i) => (
                <VoteCard
                  key={entry.id}
                  id={entry.id}
                  situation={entry.situation}
                  motivation={entry.motivation}
                  expectedOutcome={entry.expectedOutcome}
                  fullSentence={entry.fullSentence}
                  mode={exercise.jtbdMode}
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
          )}

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

function SupportingAccordion({
  entries,
  mode,
  canonicalEntries,
  onBreakOut,
  onMove,
}: {
  entries: Entry[]
  mode: 'classic' | 'hiring'
  canonicalEntries?: Entry[]
  onBreakOut?: (entryId: string) => Promise<void>
  onMove?: (entryId: string, targetCanonicalId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const interactive = !!(onBreakOut && onMove)

  return (
    <div className="mt-1 ml-3 border-l-2 border-warm-border pl-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink transition-colors py-1"
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {entries.length} similar {entries.length === 1 ? 'entry' : 'entries'}
      </button>
      {open && (
        <div className="space-y-2 mt-1 pb-1">
          {entries.map((entry) => (
            <SupportingEntryCard
              key={entry.id}
              entry={entry}
              mode={mode}
              canonicalEntries={canonicalEntries ?? []}
              interactive={interactive}
              onBreakOut={onBreakOut}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SupportingEntryCard({
  entry,
  mode,
  canonicalEntries,
  interactive,
  onBreakOut,
  onMove,
}: {
  entry: Entry
  mode: 'classic' | 'hiring'
  canonicalEntries: Entry[]
  interactive: boolean
  onBreakOut?: (entryId: string) => Promise<void>
  onMove?: (entryId: string, targetCanonicalId: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [moveTarget, setMoveTarget] = useState('')

  async function handleBreakOut() {
    if (!onBreakOut || loading) return
    setLoading(true)
    try {
      await onBreakOut(entry.id)
    } finally {
      setLoading(false)
    }
  }

  async function handleMoveSelect(targetId: string) {
    if (!onMove || !targetId || loading) return
    setLoading(true)
    try {
      await onMove(entry.id, targetId)
    } finally {
      setLoading(false)
      setMoveTarget('')
    }
  }

  return (
    <div className="bg-canvas rounded-[10px] border border-warm-border px-4 py-3">
      {mode === 'hiring' ? (
        <p className="text-xs text-ink-2 leading-relaxed">
          <strong>I am hiring it to</strong> {entry.situation}.
        </p>
      ) : (
        <p className="text-xs text-ink-2 leading-relaxed">
          <strong>When</strong> {entry.situation},{' '}
          <strong>I want to</strong> {entry.motivation},{' '}
          <strong>so I can</strong> {entry.expectedOutcome}.
        </p>
      )}

      {interactive && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBreakOut}
            disabled={loading}
            className="text-xs text-ink-3 hover:text-ink border border-warm-border rounded-full px-2.5 py-1 hover:border-ink transition-all disabled:opacity-40"
          >
            Break out
          </button>
          <select
            value={moveTarget}
            onChange={(e) => {
              setMoveTarget(e.target.value)
              handleMoveSelect(e.target.value)
            }}
            disabled={loading || canonicalEntries.length === 0}
            className="text-xs text-ink-3 border border-warm-border rounded-full px-2.5 py-1 bg-canvas hover:border-ink focus:outline-none focus:border-ink cursor-pointer disabled:opacity-40 max-w-[220px]"
          >
            <option value="" disabled>Move statement…</option>
            {canonicalEntries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullSentence.length > 72 ? c.fullSentence.slice(0, 72) + '…' : c.fullSentence}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function PhaseBadge({ phase }: { phase: 1 | 2 | 3 | 4 | 5 }) {
  const labels = {
    1: 'Phase 1: Creation',
    2: 'Phase 2: Voting',
    3: 'Phase 3: Discussion',
    4: 'Phase 4: Brainstorming',
    5: 'Phase 5: Synthesis',
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sand text-ink border border-warm-border">
      <span className="w-1.5 h-1.5 rounded-full bg-ink opacity-50" />
      {labels[phase]}
    </span>
  )
}
