'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'single' | 'multi'

const DIFFERENTIATION_LABELS = ['Not necessary', 'Table stakes', 'Differentiator']

export function CreateWorkshopForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [topN, setTopN] = useState(2)
  const [mode, setMode] = useState<Mode>('single')
  // Editable name/help for the two fixed multi-mode axes.
  const [stickiness, setStickiness] = useState({ name: 'Stickiness', description: 'Would people miss it if it disappeared?' })
  const [differentiation, setDifferentiation] = useState({ name: 'Differentiation', description: 'Does this make us meaningfully different?' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { name: name.trim(), description: description.trim(), mode }
      if (mode === 'multi') {
        body.dimensions = [
          { key: 'stickiness', name: stickiness.name.trim() || 'Stickiness', description: stickiness.description.trim() },
          { key: 'differentiation', name: differentiation.name.trim() || 'Differentiation', description: differentiation.description.trim() },
        ]
      } else {
        body.topN = topN
      }
      const res = await fetch('/api/workshop/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Could not create workshop')
      }
      const { workshop } = await res.json()
      router.push(`/workshop/${workshop.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create workshop')
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
      >
        + New workshop
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="p-4 bg-surface border border-line rounded-lg space-y-3">
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">Workshop name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={200}
          placeholder="Q3 Priorities"
          className="w-full px-3 py-2 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">Description <span className="text-ink-muted font-normal">(optional)</span></label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          placeholder="What are we prioritizing and why?"
          className="w-full px-3 py-2 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">Prioritization mode</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`text-left p-3 rounded-md border transition-colors ${
              mode === 'single' ? 'border-ink bg-canvas ring-1 ring-ink' : 'border-line bg-canvas hover:border-ink'
            }`}
          >
            <p className="text-sm font-semibold text-ink">Single ranking</p>
            <p className="text-xs text-ink-muted mt-0.5">Rank each category once, then a combined round.</p>
          </button>
          <button
            type="button"
            onClick={() => setMode('multi')}
            className={`text-left p-3 rounded-md border transition-colors ${
              mode === 'multi' ? 'border-ink bg-canvas ring-1 ring-ink' : 'border-line bg-canvas hover:border-ink'
            }`}
          >
            <p className="text-sm font-semibold text-ink">Stickiness × Differentiation</p>
            <p className="text-xs text-ink-muted mt-0.5">Rank stickiness, label differentiation, plot a matrix.</p>
          </button>
        </div>
      </div>

      {mode === 'single' ? (
        <div>
          <label className="block text-sm font-semibold text-ink mb-1">Items advanced per category</label>
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="px-3 py-2 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>Top {n} (ties may add more, up to 4)</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Stickiness — a forced-rank axis */}
          <div className="p-3 rounded-md border border-line bg-canvas">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Axis 1 · Ranked</span>
            </div>
            <input
              value={stickiness.name}
              onChange={(e) => setStickiness((s) => ({ ...s, name: e.target.value }))}
              maxLength={60}
              className="w-full px-3 py-1.5 border border-line rounded-md text-sm font-semibold text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-ink mb-1.5"
            />
            <input
              value={stickiness.description}
              onChange={(e) => setStickiness((s) => ({ ...s, description: e.target.value }))}
              maxLength={200}
              placeholder="Helper text shown to participants"
              className="w-full px-3 py-1.5 border border-line rounded-md text-xs text-ink-soft bg-surface focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          {/* Differentiation — a fixed 3-value choice axis */}
          <div className="p-3 rounded-md border border-line bg-canvas">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Axis 2 · Labelled</span>
            </div>
            <input
              value={differentiation.name}
              onChange={(e) => setDifferentiation((s) => ({ ...s, name: e.target.value }))}
              maxLength={60}
              className="w-full px-3 py-1.5 border border-line rounded-md text-sm font-semibold text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-ink mb-1.5"
            />
            <input
              value={differentiation.description}
              onChange={(e) => setDifferentiation((s) => ({ ...s, description: e.target.value }))}
              maxLength={200}
              placeholder="Helper text shown to participants"
              className="w-full px-3 py-1.5 border border-line rounded-md text-xs text-ink-soft bg-surface focus:outline-none focus:ring-1 focus:ring-ink mb-2"
            />
            <div className="flex flex-wrap gap-1.5">
              {DIFFERENTIATION_LABELS.map((label, i) => (
                <span
                  key={label}
                  className="px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[11px] font-medium text-ink-soft"
                >
                  {i + 1}. {label}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-ink-muted mt-1.5">Participants pick one of these per item (fixed).</p>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-fail">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {busy ? 'Creating…' : 'Create & add items'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
