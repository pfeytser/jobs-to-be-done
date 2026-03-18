'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Timer } from './Timer'

interface Exercise {
  id: string
  name: string
  mainPrompt?: string | null
  isActive: boolean
  isArchived: boolean
  currentPhase: 1 | 2 | 3 | 4
  timerEndsAt?: string | null
  createdAt: string
  type: 'jtbd' | 'sentiment'
  jtbdMode: 'classic' | 'hiring'
  sentimentAnalysis?: object | null
}

interface PerUserSpend {
  userId: string
  userName: string | null
  used: number
  remaining: number
}

interface VoteData {
  perUserSpend?: PerUserSpend[]
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

export function AdminPanel() {
  const [newExerciseName, setNewExerciseName] = useState('')
  const [newExercisePrompt, setNewExercisePrompt] = useState('')
  const [newExerciseType, setNewExerciseType] = useState<'jtbd' | 'sentiment'>('jtbd')
  const [newJtbdMode, setNewJtbdMode] = useState<'classic' | 'hiring'>('classic')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [timerMinutes, setTimerMinutes] = useState('5')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [deduplicating, setDeduplicating] = useState(false)
  const [brainstormGenerating, setBrainstormGenerating] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const { data, mutate } = useSWR<{ exercises: Exercise[] }>(
    '/api/exercises',
    fetcher,
    { refreshInterval: 5000 }
  )

  const exercises = data?.exercises ?? []
  const activeExercise = exercises.find((e) => e.isActive)
  const visibleExercises = exercises.filter((e) => !e.isArchived)
  const archivedExercises = exercises.filter((e) => e.isArchived)

  const { data: voteData } = useSWR<VoteData>(
    activeExercise?.currentPhase === 2
      ? `/api/exercises/${activeExercise.id}/votes`
      : null,
    fetcher,
    { refreshInterval: 5000 }
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newExerciseName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newExerciseName.trim(),
          mainPrompt: newExercisePrompt.trim() || null,
          type: newExerciseType,
          jtbdMode: newExerciseType === 'jtbd' ? newJtbdMode : 'classic',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create')
      }
      setNewExerciseName('')
      setNewExercisePrompt('')
      setNewExerciseType('jtbd')
      setNewJtbdMode('classic')
      await mutate()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  async function handlePatch(id: string, patch: Record<string, unknown>) {
    const key = JSON.stringify(patch)
    setActionLoading(id + key)
    try {
      const res = await fetch(`/api/exercises/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      await mutate()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSetTimer(exerciseId: string) {
    const minutes = parseFloat(timerMinutes)
    if (isNaN(minutes) || minutes <= 0) {
      alert('Enter a valid number of minutes')
      return
    }
    const endsAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
    await handlePatch(exerciseId, { timerEndsAt: endsAt })
  }

  async function handleClearTimer(exerciseId: string) {
    await handlePatch(exerciseId, { timerEndsAt: null })
  }

  async function handleSwitchPhase(exerciseId: string, phase: 1 | 2 | 3 | 4) {
    await handlePatch(exerciseId, { currentPhase: phase })
    if (phase === 2 && activeExercise?.type === 'jtbd') {
      await triggerDeduplicate(exerciseId)
    }
    if (phase === 4) {
      await triggerBrainstormGenerate(exerciseId)
    }
  }

  async function triggerDeduplicate(exerciseId: string) {
    setDeduplicating(true)
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/deduplicate`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Deduplication failed. Please try again.')
      }
      await mutate()
    } catch {
      alert('Deduplication failed. Please try again.')
    } finally {
      setDeduplicating(false)
    }
  }

  async function triggerBrainstormGenerate(exerciseId: string) {
    setBrainstormGenerating(true)
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/brainstorm/generate`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Generation failed. Please try again.')
      }
      await mutate()
    } catch {
      alert('Generation failed. Please try again.')
    } finally {
      setBrainstormGenerating(false)
    }
  }

  async function handleGenerateAnalysis(exerciseId: string) {
    setAnalyzing(true)
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/analyze`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Analysis failed')
      }
      await mutate()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Create Exercise */}
      <section className="bg-surface rounded-[14px] border border-warm-border p-6" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
        <h2 className="text-base font-semibold text-ink mb-4">Create Exercise</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          {/* Exercise type selector */}
          <div className="flex gap-2">
            {(['jtbd', 'sentiment'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setNewExerciseType(t)
                  if (t === 'sentiment' && !newExercisePrompt.trim()) {
                    setNewExercisePrompt('What feeling do you want to evoke in our members when they are using our app?')
                  }
                  if (t === 'jtbd') {
                    setNewExercisePrompt('')
                  }
                }}
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-all border ${
                  newExerciseType === t
                    ? 'bg-ink text-white border-ink'
                    : 'bg-canvas text-ink-2 border-warm-border hover:border-ink hover:text-ink'
                }`}
              >
                {t === 'jtbd' ? 'Jobs to Be Done' : 'Sentiment Design'}
              </button>
            ))}
          </div>
          {/* JTBD mode selector */}
          {newExerciseType === 'jtbd' && (
            <div className="flex gap-2">
              {(['classic', 'hiring'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNewJtbdMode(m)}
                  className={`flex-1 py-2 rounded-full text-sm font-medium transition-all border ${
                    newJtbdMode === m
                      ? 'bg-ink text-white border-ink'
                      : 'bg-canvas text-ink-2 border-warm-border hover:border-ink hover:text-ink'
                  }`}
                >
                  {m === 'classic' ? 'Classic JTBD' : 'Hiring Mode'}
                </button>
              ))}
            </div>
          )}

          <input
            type="text"
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            placeholder={newExerciseType === 'sentiment' ? 'Exercise name (e.g. Member Sentiment — Q1 2025)' : 'Exercise name (e.g. Q1 2025 App Roadmap)'}
            className="w-full px-4 py-2.5 border border-warm-border rounded-[14px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition-all"
            maxLength={200}
            required
          />
          <input
            type="text"
            value={newExercisePrompt}
            onChange={(e) => setNewExercisePrompt(e.target.value)}
            placeholder={
              newExerciseType === 'sentiment'
                ? 'What feeling do you want to evoke in our members when they are using our app?'
                : 'Main prompt question (e.g. What job are members hiring the app for?)'
            }
            className="w-full px-4 py-2.5 border border-warm-border rounded-[14px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition-all"
            maxLength={500}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating || !newExerciseName.trim()}
              className="px-5 py-2.5 bg-ink text-white rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
            >
              {creating ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              Create
            </button>
          </div>
        </form>
        {createError && (
          <p className="mt-2 text-red-600 text-sm">{createError}</p>
        )}
      </section>

      {/* Active Exercise Controls */}
      {activeExercise && (
        <section className="bg-surface rounded-[14px] border border-warm-border p-6" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <h2 className="text-base font-semibold text-ink">Active: {activeExercise.name}</h2>
              </div>
              <div className="flex items-center gap-3">
                <PhaseBadge phase={activeExercise.currentPhase} exerciseType={activeExercise.type} />
                <Timer endsAt={activeExercise.timerEndsAt} />
              </div>
            </div>
            <button
              onClick={() => handlePatch(activeExercise.id, { isActive: false })}
              className="text-xs text-ink-3 hover:text-red-600 transition-colors"
            >
              Deactivate
            </button>
          </div>

          {/* Prompt Question */}
          <div className="mb-5">
            <p className="text-sm font-medium text-ink mb-2">Main Prompt Question</p>
            <div className="flex gap-2">
              <PromptEditor exercise={activeExercise} onPatch={handlePatch} />
            </div>
          </div>

          {/* Phase Controls */}
          <div className="mb-5">
            <p className="text-sm font-medium text-ink mb-2">Set Phase</p>
            {activeExercise.type === 'sentiment' ? (
              <div className="flex gap-2">
                {([1, 2] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePatch(activeExercise.id, { currentPhase: p })}
                    disabled={activeExercise.currentPhase === p || !!actionLoading}
                    className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all ${
                      activeExercise.currentPhase === p
                        ? 'bg-ink text-white'
                        : 'bg-canvas text-ink-2 border border-warm-border hover:border-ink hover:text-ink disabled:opacity-50'
                    }`}
                  >
                    {p === 1 ? '1 · Creation' : '2 · Analysis'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {([1, 2, 3, 4] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleSwitchPhase(activeExercise.id, p)}
                    disabled={activeExercise.currentPhase === p || !!actionLoading || (p === 2 && deduplicating) || (p === 4 && brainstormGenerating)}
                    className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all ${
                      activeExercise.currentPhase === p
                        ? 'bg-ink text-white'
                        : 'bg-canvas text-ink-2 border border-warm-border hover:border-ink hover:text-ink disabled:opacity-50'
                    }`}
                  >
                    {p === 1 ? '1 · Creation' : p === 2 ? '2 · Voting' : p === 3 ? '3 · Discussion' : '4 · Brainstorm'}
                  </button>
                ))}
              </div>
            )}
            {deduplicating && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Consolidating entries…
              </div>
            )}
            {brainstormGenerating && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating problem statements…
              </div>
            )}
            {activeExercise.type === 'jtbd' && activeExercise.currentPhase === 4 && !brainstormGenerating && (
              <button
                onClick={() => triggerBrainstormGenerate(activeExercise.id)}
                className="mt-2 px-4 py-2 bg-canvas border border-warm-border text-ink-2 rounded-full text-xs font-medium hover:border-ink hover:text-ink transition-all"
              >
                Regenerate problem statements
              </button>
            )}
          </div>

          {/* Generate Analysis (Sentiment only, Phase 2) */}
          {activeExercise.type === 'sentiment' && activeExercise.currentPhase === 2 && !activeExercise.sentimentAnalysis && (
            <div className="mb-5">
              <p className="text-sm font-medium text-ink mb-2">AI Analysis</p>
              <button
                onClick={() => handleGenerateAnalysis(activeExercise.id)}
                disabled={analyzing}
                className="flex items-center gap-2 px-5 py-2.5 bg-ink text-white rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {analyzing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Generate Analysis
                  </>
                )}
              </button>
            </div>
          )}
          {activeExercise.type === 'sentiment' && activeExercise.sentimentAnalysis && (
            <div className="mb-5 flex items-center gap-2 text-sm text-ink-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Analysis complete — visible to participants
            </div>
          )}

          {/* Timer Controls */}
          <div>
            <p className="text-sm font-medium text-ink mb-2">Countdown Timer</p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(e.target.value)}
                min="1"
                max="60"
                step="1"
                className="w-24 px-3 py-2 border border-warm-border rounded-[14px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink"
              />
              <span className="text-sm text-ink-3">minutes</span>
              <button
                onClick={() => handleSetTimer(activeExercise.id)}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-ink text-white rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Start Timer
              </button>
              {activeExercise.timerEndsAt && (
                <button
                  onClick={() => handleClearTimer(activeExercise.id)}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-canvas border border-warm-border text-ink-2 rounded-full text-sm font-medium hover:border-ink hover:text-ink disabled:opacity-40 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Voting Progress (Phase 2 only) */}
          {activeExercise.currentPhase === 2 && voteData?.perUserSpend && (
            <div className="mt-5 pt-5 border-t border-warm-border">
              <p className="text-sm font-medium text-ink mb-3">Per-User Vote Progress</p>
              {voteData.perUserSpend.length === 0 ? (
                <p className="text-sm text-ink-3">No votes cast yet</p>
              ) : (
                <div className="space-y-2">
                  {voteData.perUserSpend.map((u) => (
                    <div key={u.userId} className="flex items-center gap-3">
                      <div className="text-xs text-ink-3 truncate max-w-[140px]">
                        {u.userName ?? u.userId.substring(0, 8) + '…'}
                      </div>
                      <div className="flex-1 h-1.5 bg-canvas rounded-full overflow-hidden border border-warm-border">
                        <div
                          className="h-full bg-ink rounded-full transition-all"
                          style={{ width: `${(u.used / 20) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-ink-2 tabular-nums">
                        {u.used}/20
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* All Exercises */}
      <section className="bg-surface rounded-[14px] border border-warm-border p-6" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
        <h2 className="text-base font-semibold text-ink mb-4">
          All Exercises ({visibleExercises.length})
        </h2>
        {visibleExercises.length === 0 ? (
          <p className="text-ink-3 text-sm">No exercises yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {visibleExercises.map((ex) => (
              <div
                key={ex.id}
                className={`flex items-center justify-between p-4 rounded-[14px] border transition-colors ${
                  ex.isActive ? 'bg-sand border-warm-border' : 'bg-canvas border-warm-border'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {ex.isActive && (
                    <span className="w-2 h-2 bg-green-500 rounded-full shrink-0 animate-pulse" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{ex.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <PhaseBadge phase={ex.currentPhase} small exerciseType={ex.type} />
                      {ex.type === 'jtbd' && ex.jtbdMode === 'hiring' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-mist text-ink-2 border border-warm-border font-medium">
                          Hiring
                        </span>
                      )}
                      <span className="text-xs text-ink-3">
                        {new Date(ex.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!ex.isActive && (
                    <button
                      onClick={() => handlePatch(ex.id, { isActive: true })}
                      disabled={!!actionLoading}
                      className="px-4 py-1.5 bg-surface border border-warm-border text-ink text-xs font-medium rounded-full hover:bg-ink hover:text-white hover:border-ink disabled:opacity-50 transition-all"
                    >
                      Activate
                    </button>
                  )}
                  {!ex.isActive && (
                    <button
                      onClick={() => handlePatch(ex.id, { isArchived: true })}
                      disabled={!!actionLoading}
                      className="px-3 py-1.5 text-ink-3 hover:text-ink text-xs font-medium transition-colors disabled:opacity-50"
                      title="Archive"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Archive accordion */}
        {archivedExercises.length > 0 && (
          <div className="mt-4 pt-4 border-t border-warm-border">
            <button
              onClick={() => setArchiveOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink transition-colors w-full text-left"
            >
              <svg
                className={`w-4 h-4 transition-transform ${archiveOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Archive ({archivedExercises.length})
            </button>

            {archiveOpen && (
              <div className="mt-3 space-y-2">
                {archivedExercises.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between p-4 rounded-[14px] border border-warm-border bg-canvas opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{ex.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <PhaseBadge phase={ex.currentPhase} small exerciseType={ex.type} />
                        <span className="text-xs text-ink-3">
                          {new Date(ex.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePatch(ex.id, { isArchived: false })}
                      disabled={!!actionLoading}
                      className="shrink-0 px-3 py-1.5 text-ink-3 hover:text-ink text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      Unarchive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function PromptEditor({
  exercise,
  onPatch,
}: {
  exercise: Exercise
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const [value, setValue] = useState(exercise.mainPrompt ?? '')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await onPatch(exercise.id, { mainPrompt: value.trim() || null })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex gap-2 w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false) }}
        placeholder="e.g. What job are members hiring the app for?"
        className="flex-1 px-4 py-2 border border-warm-border rounded-[14px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition-all"
        maxLength={500}
      />
      <button
        onClick={handleSave}
        className="px-4 py-2 bg-ink text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
      >
        {saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  )
}

function PhaseBadge({
  phase,
  small = false,
  exerciseType = 'jtbd',
}: {
  phase: 1 | 2 | 3 | 4
  small?: boolean
  exerciseType?: 'jtbd' | 'sentiment'
}) {
  const labels: Record<number, string> =
    exerciseType === 'sentiment'
      ? { 1: 'Creation', 2: 'Analysis', 3: 'Analysis', 4: 'Brainstorm' }
      : { 1: 'Creation', 2: 'Voting', 3: 'Discussion', 4: 'Brainstorm' }
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium bg-sand text-ink ${
        small ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
      }`}
    >
      Phase {phase}: {labels[phase]}
    </span>
  )
}
