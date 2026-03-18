'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Timer } from './Timer'

interface Exercise {
  id: string
  name: string
  mainPrompt?: string | null
  isActive: boolean
  currentPhase: 1 | 2 | 3
  timerEndsAt?: string | null
  createdAt: string
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
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [timerMinutes, setTimerMinutes] = useState('5')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const { data, mutate } = useSWR<{ exercises: Exercise[] }>(
    '/api/exercises',
    fetcher,
    { refreshInterval: 5000 }
  )

  const exercises = data?.exercises ?? []
  const activeExercise = exercises.find((e) => e.isActive)

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
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create')
      }
      setNewExerciseName('')
      setNewExercisePrompt('')
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

  return (
    <div className="space-y-6">
      {/* Create Exercise */}
      <section className="bg-surface rounded-[14px] border border-warm-border p-6" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
        <h2 className="text-base font-semibold text-ink mb-4">Create Exercise</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            type="text"
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            placeholder="Exercise name (e.g. Q1 2025 App Roadmap)"
            className="w-full px-4 py-2.5 border border-warm-border rounded-[14px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition-all"
            maxLength={200}
            required
          />
          <input
            type="text"
            value={newExercisePrompt}
            onChange={(e) => setNewExercisePrompt(e.target.value)}
            placeholder="Main prompt question (e.g. What job are members hiring the app for?)"
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
                <PhaseBadge phase={activeExercise.currentPhase} />
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
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((p) => (
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
                  {p === 1 ? '1 · Creation' : p === 2 ? '2 · Voting' : '3 · Discussion'}
                </button>
              ))}
            </div>
          </div>

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
          All Exercises ({exercises.length})
        </h2>
        {exercises.length === 0 ? (
          <p className="text-ink-3 text-sm">No exercises yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className={`flex items-center justify-between p-4 rounded-[14px] border transition-colors ${
                  ex.isActive
                    ? 'bg-sand border-warm-border'
                    : 'bg-canvas border-warm-border'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {ex.isActive && (
                    <span className="w-2 h-2 bg-green-500 rounded-full shrink-0 animate-pulse" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{ex.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <PhaseBadge phase={ex.currentPhase} small />
                      <span className="text-xs text-ink-3">
                        {new Date(ex.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                {!ex.isActive && (
                  <button
                    onClick={() => handlePatch(ex.id, { isActive: true })}
                    disabled={!!actionLoading}
                    className="shrink-0 px-4 py-1.5 bg-surface border border-warm-border text-ink text-xs font-medium rounded-full hover:bg-ink hover:text-white hover:border-ink disabled:opacity-50 transition-all"
                  >
                    Activate
                  </button>
                )}
              </div>
            ))}
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
}: {
  phase: 1 | 2 | 3
  small?: boolean
}) {
  const labels = { 1: 'Creation', 2: 'Voting', 3: 'Discussion' }
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
