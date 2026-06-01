'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface InitialStatement {
  position: number
  text: string
  is_lie: boolean
}

export function AuthorSetup({
  sessionId,
  title,
  initial,
}: {
  sessionId: string
  title: string
  initial: InitialStatement[]
}) {
  const router = useRouter()
  const sorted = [...initial].sort((a, b) => a.position - b.position)
  const [texts, setTexts] = useState<string[]>(sorted.map((s) => s.text))
  const [lieIndex, setLieIndex] = useState<number>(() => {
    const idx = sorted.findIndex((s) => s.is_lie)
    return idx >= 0 ? idx : 2
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (texts.some((t) => !t.trim())) {
      setError('Fill in all three statements before saving.')
      return
    }
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/two-truths/sessions/${sessionId}/statements`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statements: texts.map((text, i) => ({ text: text.trim(), is_lie: i === lieIndex })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not save. Try again.')
      }
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-3 mb-2">✍️ Set up your game</p>
        <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">{title}</h1>

        <div className="mt-4 p-4 rounded-xl bg-mist border border-warm-border text-sm text-ink-2">
          Write two true statements and one lie. Mark which one is the lie — players won&apos;t see your
          choice. <span className="font-semibold text-ink">You can keep editing until the host starts the game.</span>
        </div>

        <div className="mt-6 space-y-4">
          {texts.map((text, i) => {
            const isLie = i === lieIndex
            return (
              <div
                key={i}
                className={`rounded-2xl border-2 p-4 transition-colors ${
                  isLie ? 'border-status-fail-border bg-status-fail/40' : 'border-warm-border bg-surface'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-ink">Statement {i + 1}</label>
                  <button
                    type="button"
                    onClick={() => setLieIndex(i)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      isLie
                        ? 'bg-status-fail-text text-white'
                        : 'bg-canvas text-ink-3 border border-warm-border hover:border-ink'
                    }`}
                  >
                    {isLie ? '🤥 This is the lie' : 'Mark as lie'}
                  </button>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => {
                    const next = [...texts]
                    next[i] = e.target.value
                    setTexts(next)
                  }}
                  rows={2}
                  maxLength={500}
                  placeholder={isLie ? 'Something believable but false…' : 'Something true about you…'}
                  className="w-full resize-none bg-transparent text-ink placeholder:text-ink-3 focus:outline-none text-base"
                />
              </div>
            )
          })}
        </div>

        {error && <p className="mt-4 text-sm text-status-fail-text font-medium">{error}</p>}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-3 bg-ink text-white font-bold rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save statements'}
          </button>
          {saved && <span className="text-sm font-semibold text-status-pass-text">Saved ✓</span>}
        </div>
      </div>
    </main>
  )
}
