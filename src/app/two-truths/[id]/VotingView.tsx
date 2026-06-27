'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DisplayStatement {
  id: string
  text: string
}

export function VotingView({
  sessionId,
  title,
  authorName,
  statements,
}: {
  sessionId: string
  title: string
  authorName: string
  statements: DisplayStatement[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/two-truths/sessions/${sessionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId: selected }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not submit your vote.')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your vote.')
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-2">🎯 Spot the lie</p>
        <h1 className="font-display leading-tight text-3xl sm:text-4xl font-light text-ink tracking-tight">{title}</h1>
        <p className="text-ink-soft mt-1">
          by {authorName} · Tap the statement you think is <span className="font-bold text-ink">the lie</span>
        </p>

        <div className="mt-6 space-y-3">
          {statements.map((s, i) => {
            const isSelected = selected === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                disabled={submitting}
                className={`w-full text-left p-5 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-ink bg-accent/25 shadow-md scale-[1.01]'
                    : 'border-line bg-surface hover:border-ink/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm font-black transition-colors ${
                      isSelected ? 'bg-ink text-white' : 'bg-canvas text-ink-muted border border-line'
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-lg text-ink font-medium leading-snug">{s.text}</span>
                </div>
              </button>
            )
          })}
        </div>

        {error && <p className="mt-4 text-sm text-fail font-medium">{error}</p>}

        <button
          onClick={submit}
          disabled={!selected || submitting}
          className="mt-6 w-full py-4 bg-ink text-white text-lg font-bold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {submitting ? 'Locking it in…' : selected ? 'Lock in my guess 🔒' : 'Pick a statement'}
        </button>
        <p className="text-center text-xs text-ink-muted mt-3">
          You get one vote — and it&apos;s final once you lock it in.
        </p>
      </div>
    </main>
  )
}
