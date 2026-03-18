'use client'

import { useState, useEffect } from 'react'

interface SolutionModalProps {
  exerciseId: string
  entryId: string
  statementPreview: string
  problemStatement: string | null
  onClose: () => void
  onSubmitted: () => void
}

export function SolutionModal({
  exerciseId,
  entryId,
  statementPreview,
  problemStatement,
  onClose,
  onSubmitted,
}: SolutionModalProps) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Close on Escape
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
        `/api/exercises/${exerciseId}/brainstorm/${entryId}/solutions`,
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
              <p className="text-sm font-medium text-ink leading-snug">
                {statementPreview}
              </p>
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
          {problemStatement && (
            <div className="mt-3 px-3 py-2.5 bg-canvas rounded-[10px] border border-warm-border">
              <p className="text-xs text-ink-2 leading-relaxed">
                <span className="font-semibold text-ink-3">Problem: </span>
                {problemStatement}
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              What feature could help solve this?
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. A smart reminder that detects travel time and nudges you 10 minutes before you need to leave…"
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
