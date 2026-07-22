'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface EditableDimension {
  key: string
  name: string
  description: string
  type: 'rank' | 'choice'
  options?: { key: string; label: string }[]
}

/**
 * Facilitator-only panel to rename / redescribe a multi-mode workshop's axes
 * after creation. Only the name and helper text are editable — the axis type
 * and the fixed choice options are locked (shown read-only).
 */
export function DimensionSettings({
  workshopId,
  dimensions,
}: {
  workshopId: string
  dimensions: EditableDimension[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() =>
    dimensions.map((d) => ({ key: d.key, name: d.name, description: d.description }))
  )
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(key: string, field: 'name' | 'description', value: string) {
    setSaved(false)
    setDraft((prev) => prev.map((d) => (d.key === key ? { ...d, [field]: value } : d)))
  }

  async function save() {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/workshop/sessions/${workshopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-dimensions',
          dimensions: draft.map((d) => ({ key: d.key, name: d.name.trim() || d.key, description: d.description.trim() })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not save')
      }
      setSaved(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-line bg-surface/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-ink-soft">⚙ Axis labels</span>
        <span className="text-xs text-ink-muted">{open ? 'Hide' : 'Edit names & helper text'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-line pt-4">
          {draft.map((d) => {
            const source = dimensions.find((x) => x.key === d.key)
            return (
              <div key={d.key} className="p-3 rounded-md border border-line bg-canvas">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                    {source?.type === 'choice' ? 'Labelled axis' : 'Ranked axis'}
                  </span>
                </div>
                <input
                  value={d.name}
                  onChange={(e) => update(d.key, 'name', e.target.value)}
                  maxLength={60}
                  placeholder="Axis name"
                  className="w-full px-3 py-1.5 border border-line rounded-md text-sm font-semibold text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-ink mb-1.5"
                />
                <input
                  value={d.description}
                  onChange={(e) => update(d.key, 'description', e.target.value)}
                  maxLength={200}
                  placeholder="Helper text shown to participants"
                  className="w-full px-3 py-1.5 border border-line rounded-md text-xs text-ink-soft bg-surface focus:outline-none focus:ring-1 focus:ring-ink"
                />
                {source?.type === 'choice' && source.options && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {source.options.map((o, i) => (
                      <span
                        key={o.key}
                        className="px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[11px] font-medium text-ink-soft"
                      >
                        {i + 1}. {o.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy}
              className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Saving…' : 'Save axis labels'}
            </button>
            {saved && <span className="text-xs text-pass">✓ Saved</span>}
            {error && <span className="text-xs text-fail">{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
