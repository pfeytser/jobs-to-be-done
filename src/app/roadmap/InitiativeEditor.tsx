'use client'

import { useEffect, useState } from 'react'
import type { Initiative, InitiativeStatus, Priority, Theme, ImpactUnit } from '@/lib/roadmap/types'
import { QUARTERS, THEME_META, THEME_ORDER } from '@/lib/roadmap/types'

export type InitiativeDraft = Omit<Initiative, 'id' | 'sort_order'> & { id?: string }

const STATUSES: InitiativeStatus[] = ['proposed', 'to_do', 'in_flight', 'done']
const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low']

const fieldCls =
  'w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-ink focus:outline-none'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1'

// Slide-over editor for one initiative (create or edit). Emits a full draft on
// save; the parent handles persistence and local state.
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
  useEffect(() => setD(draft), [draft])

  const set = <K extends keyof InitiativeDraft>(key: K, value: InitiativeDraft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }))

  const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v))

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-bold text-ink">{isNew ? 'New initiative' : 'Edit initiative'}</h2>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
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
            <textarea
              value={d.summary}
              onChange={(e) => set('summary', e.target.value)}
              rows={4}
              className={`${fieldCls} resize-y`}
            />
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Year</label>
              <select value={d.year} onChange={(e) => set('year', Number(e.target.value))} className={fieldCls}>
                {[...new Set(QUARTERS.map((q) => q.year))].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Quarter</label>
              <select value={d.quarter} onChange={(e) => set('quarter', Number(e.target.value))} className={fieldCls}>
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </select>
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Impact value</label>
              <input
                type="number"
                min={0}
                value={d.impact_value ?? ''}
                onChange={(e) => set('impact_value', numOrNull(e.target.value))}
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Impact unit</label>
              <select
                value={d.impact_unit ?? ''}
                onChange={(e) => set('impact_unit', (e.target.value || null) as ImpactUnit | null)}
                className={fieldCls}
              >
                <option value="">—</option>
                <option value="revenue">revenue ($)</option>
                <option value="hrs">hours</option>
              </select>
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

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={d.committed === 1}
                onChange={(e) => set('committed', e.target.checked ? 1 : 0)}
                className="accent-[#1D5859]"
              />
              Committed (counts against capacity)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={d.is_required === 1}
                onChange={(e) => set('is_required', e.target.checked ? 1 : 0)}
                className="accent-[#1D5859]"
              />
              Required
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
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
              onClick={onClose}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(d)}
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
