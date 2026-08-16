'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUADRANT_KEYS, type AxisLabels, type QuadrantKey } from '@/lib/quadrant-model'

const inputCls =
  'w-full px-3 py-1.5 border border-line rounded-md text-sm text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-ink'

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">{label}</span>
      <input value={value} maxLength={80} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  )
}

/** Collapsible editor for the axis names, pole captions, and quadrant names.
 *  The four-quadrant structure is fixed; only the labels change. */
export function AxisSettings({ projectId, axisLabels }: { projectId: string; axisLabels: AxisLabels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [labels, setLabels] = useState<AxisLabels>(axisLabels)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof AxisLabels>(key: K, value: AxisLabels[K]) {
    setSaved(false)
    setLabels((l) => ({ ...l, [key]: value }))
  }
  function setQuadrant(key: QuadrantKey, value: string) {
    setSaved(false)
    setLabels((l) => ({ ...l, quadrants: { ...l.quadrants, [key]: value } }))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quadrant/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-labels', axisLabels: labels }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Could not save labels')
      }
      setSaved(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save labels')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-line bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-ink">Axis &amp; quadrant labels</span>
        <span className="text-xs text-ink-muted">{open ? 'Hide' : 'Edit'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-line pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Horizontal axis name" value={labels.horizontalAxis} onChange={(v) => set('horizontalAxis', v)} />
            <Field label="Vertical axis name" value={labels.verticalAxis} onChange={(v) => set('verticalAxis', v)} />
            <Field label="Left pole" value={labels.horizontalLeft} onChange={(v) => set('horizontalLeft', v)} />
            <Field label="Right pole" value={labels.horizontalRight} onChange={(v) => set('horizontalRight', v)} />
            <Field label="Top pole" value={labels.verticalTop} onChange={(v) => set('verticalTop', v)} />
            <Field label="Bottom pole" value={labels.verticalBottom} onChange={(v) => set('verticalBottom', v)} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Quadrant names</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {QUADRANT_KEYS.map((key) => (
                <Field
                  key={key}
                  label={key.replace(/_/g, ' ')}
                  value={labels.quadrants[key]}
                  onChange={(v) => setQuadrant(key, v)}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-fail">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy}
              className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Saving…' : 'Save labels'}
            </button>
            {saved && <span className="text-xs text-pass">✓ Saved</span>}
          </div>
        </div>
      )}
    </div>
  )
}
