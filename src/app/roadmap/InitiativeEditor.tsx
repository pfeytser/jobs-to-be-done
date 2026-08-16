'use client'

import { useEffect, useState } from 'react'
import type { Initiative, InitiativeStatus, Priority, Theme } from '@/lib/roadmap/types'
import { BACKLOG_LABEL, QUARTERS, THEME_META, THEME_ORDER, quarterLabel } from '@/lib/roadmap/types'

export type InitiativeDraft = Omit<Initiative, 'id' | 'sort_order'> & { id?: string }

const STATUSES: InitiativeStatus[] = ['proposed', 'to_do', 'in_flight', 'done']
const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low']

const fieldCls =
  'w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-ink focus:outline-none'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1'

// Slide-over editor for one initiative (create or edit). Every field is editable.
// Animates in/out. "Timing" doubles as the To-Be-Prioritized control.
export function InitiativeEditor({
  draft,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  draft: InitiativeDraft
  isNew: boolean
  onSave: (d: InitiativeDraft) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [d, setD] = useState<InitiativeDraft>(draft)
  const [show, setShow] = useState(false)

  useEffect(() => setD(draft), [draft])
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Animate out, then run the action (unmount / persist).
  const close = (after: () => void) => {
    setShow(false)
    setTimeout(after, 300)
  }

  const set = <K extends keyof InitiativeDraft>(key: K, value: InitiativeDraft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }))

  const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v))

  const timingValue = d.unscheduled === 1 ? 'backlog' : `${d.year}-${d.quarter}`
  const onTimingChange = (v: string) => {
    if (v === 'backlog') {
      set('unscheduled', 1)
    } else {
      const [y, q] = v.split('-').map(Number)
      setD((prev) => ({ ...prev, year: y, quarter: q, unscheduled: 0 }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={`absolute inset-0 bg-ink/30 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => close(onClose)}
      />
      <div
        className={`relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl transition-transform duration-300 ease-out ${
          show ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-bold text-ink">{isNew ? 'New initiative' : 'Edit initiative'}</h2>
          <button type="button" onClick={() => close(onClose)} className="text-ink-muted hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className={labelCls}>Title</label>
            <input value={d.title} onChange={(e) => set('title', e.target.value)} className={fieldCls} />
          </div>

          <div>
            <label className={labelCls}>Summary</label>
            <textarea value={d.summary} onChange={(e) => set('summary', e.target.value)} rows={4} className={`${fieldCls} resize-y`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={d.status} onChange={(e) => set('status', e.target.value as InitiativeStatus)} className={fieldCls}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select
                value={d.priority ?? ''}
                onChange={(e) => set('priority', (e.target.value || null) as Priority | null)}
                className={fieldCls}
              >
                <option value="">—</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Theme</label>
              <select
                value={d.theme ?? ''}
                onChange={(e) => set('theme', (e.target.value || null) as Theme | null)}
                className={fieldCls}
              >
                <option value="">—</option>
                {THEME_ORDER.filter((k) => k !== '_none').map((k) => (
                  <option key={k} value={k}>
                    {THEME_META[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Timing</label>
              <select value={timingValue} onChange={(e) => onTimingChange(e.target.value)} className={fieldCls}>
                {QUARTERS.map((q) => (
                  <option key={`${q.year}-${q.quarter}`} value={`${q.year}-${q.quarter}`}>
                    {quarterLabel(q)}
                  </option>
                ))}
                <option value="backlog">{BACKLOG_LABEL}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Effort (wks)</label>
              <input
                type="number"
                min={0}
                value={d.effort_weeks ?? ''}
                onChange={(e) => set('effort_weeks', numOrNull(e.target.value))}
                className={fieldCls}
                placeholder="?"
              />
            </div>
            <div>
              <label className={labelCls}>Revenue ($)</label>
              <input
                type="number"
                min={0}
                value={d.impact_revenue ?? ''}
                onChange={(e) => set('impact_revenue', numOrNull(e.target.value))}
                className={fieldCls}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>Hours saved</label>
              <input
                type="number"
                min={0}
                value={d.impact_hours ?? ''}
                onChange={(e) => set('impact_hours', numOrNull(e.target.value))}
                className={fieldCls}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Owner</label>
              <input value={d.owner_name ?? ''} onChange={(e) => set('owner_name', e.target.value || null)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Objective</label>
              <input value={d.objective ?? ''} onChange={(e) => set('objective', e.target.value || null)} className={fieldCls} />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={d.committed === 1} onChange={(e) => set('committed', e.target.checked ? 1 : 0)} className="accent-[#1D5859]" />
              Committed (counts against capacity)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={d.is_required === 1} onChange={(e) => set('is_required', e.target.checked ? 1 : 0)} className="accent-[#1D5859]" />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={d.is_bau === 1} onChange={(e) => set('is_bau', e.target.checked ? 1 : 0)} className="accent-[#1D5859]" />
              BAU (bugs / tech debt / maintenance)
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          {onDelete ? (
            <button
              type="button"
              onClick={() => close(onDelete)}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-fail hover:border-fail"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => close(onClose)}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => d.title.trim() && close(() => onSave(d))}
              disabled={!d.title.trim()}
              className="rounded-md bg-ink px-4 py-1.5 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-40"
            >
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
