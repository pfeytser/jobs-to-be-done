'use client'

import { useState } from 'react'

interface JTBDFormProps {
  exerciseId: string
  onSubmit: (data: {
    situation: string
    motivation: string
    expectedOutcome: string
  }) => Promise<void>
}

export function JTBDForm({ exerciseId: _exerciseId, onSubmit }: JTBDFormProps) {
  const [situation, setSituation] = useState('')
  const [motivation, setMotivation] = useState('')
  const [expectedOutcome, setExpectedOutcome] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview =
    situation && motivation && expectedOutcome
      ? `When ${situation}, I want to ${motivation}, so I can ${expectedOutcome}.`
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!situation.trim() || !motivation.trim() || !expectedOutcome.trim()) return

    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        situation: situation.trim(),
        motivation: motivation.trim(),
        expectedOutcome: expectedOutcome.trim(),
      })
      setSituation('')
      setMotivation('')
      setExpectedOutcome('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-surface rounded-[14px] border border-warm-border p-6" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-ink">Add your JTBD</h2>
        <p className="text-sm text-ink-3 mt-0.5">
          Complete each part of the statement below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 text-sm pointer-events-none font-medium">
              When
            </span>
            <input
              type="text"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="the situation or context…"
              className="w-full pl-16 pr-4 py-3 border border-warm-border rounded-[14px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent focus:bg-surface transition-all"
              maxLength={500}
              required
            />
          </div>
        </div>

        <div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 text-sm pointer-events-none whitespace-nowrap font-medium">
              I want to
            </span>
            <input
              type="text"
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="what the user is trying to do…"
              className="w-full pl-[5.25rem] pr-4 py-3 border border-warm-border rounded-[14px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent focus:bg-surface transition-all"
              maxLength={500}
              required
            />
          </div>
        </div>

        <div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 text-sm pointer-events-none whitespace-nowrap font-medium">
              So I can
            </span>
            <input
              type="text"
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              placeholder="that outcome or value they hope to get…"
              className="w-full pl-[5.25rem] pr-4 py-3 border border-warm-border rounded-[14px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent focus:bg-surface transition-all"
              maxLength={500}
              required
            />
          </div>
        </div>

        {preview && (
          <div className="bg-mist rounded-[14px] p-4 border border-warm-border">
            <p className="text-xs text-ink-2 font-medium mb-1 uppercase tracking-wide">Preview</p>
            <p className="text-sm text-ink leading-relaxed italic">
              &ldquo;{preview}&rdquo;
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-[14px] text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={
            submitting ||
            !situation.trim() ||
            !motivation.trim() ||
            !expectedOutcome.trim()
          }
          className="w-full py-3 bg-ink text-white rounded-full font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            'Add Statement'
          )}
        </button>
      </form>
    </div>
  )
}
