'use client'

import { useState } from 'react'

interface SentimentFormProps {
  onSubmit: (term: string) => Promise<void>
}

export function SentimentForm({ onSubmit }: SentimentFormProps) {
  const [term, setTerm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!term.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(term.trim())
      setTerm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="bg-surface rounded-[14px] border border-warm-border p-6"
      style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-ink">Add a word or phrase</h2>
        <p className="text-sm text-ink-3 mt-0.5">
          An adjective, a feeling, or a short phrase — submit as many as you like.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. empowered, safe, effortless…"
          className="flex-1 px-4 py-3 border border-warm-border rounded-[14px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent focus:bg-surface transition-all"
          maxLength={200}
          autoComplete="off"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || !term.trim()}
          className="px-5 py-3 bg-ink text-white rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2 shrink-0"
        >
          {submitting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : null}
          Add
        </button>
      </form>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-[14px] text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
