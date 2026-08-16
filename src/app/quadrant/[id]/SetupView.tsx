'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUADRANT_KEYS, type QuadrantKey } from '@/lib/quadrant-model'
import { ShareLink } from './ShareLink'

export interface EditableTheme {
  id: string
  title: string
  items: string[]
  facilitatorReference: QuadrantKey | null
}

const inputCls =
  'w-full px-3 py-2 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink'

function itemsToText(items: string[]): string {
  return items.join('\n')
}
function textToItems(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60)
}

function RefSelect({
  value,
  quadrantLabels,
  onChange,
}: {
  value: QuadrantKey | null
  quadrantLabels: Record<QuadrantKey, string>
  onChange: (v: QuadrantKey | null) => void
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
        Facilitator reference <span className="font-normal normal-case">(private, optional)</span>
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as QuadrantKey | null)}
        className="px-3 py-2 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
      >
        <option value="">— none —</option>
        {QUADRANT_KEYS.map((k) => (
          <option key={k} value={k}>
            {quadrantLabels[k]}
          </option>
        ))}
      </select>
    </label>
  )
}

function ThemeCard({
  projectId,
  theme,
  index,
  total,
  quadrantLabels,
}: {
  projectId: string
  theme: EditableTheme
  index: number
  total: number
  quadrantLabels: Record<QuadrantKey, string>
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(theme.title)
  const [itemsText, setItemsText] = useState(itemsToText(theme.items))
  const [ref, setRef] = useState<QuadrantKey | null>(theme.facilitatorReference)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quadrant/projects/${projectId}/themes/${theme.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), items: textToItems(itemsText), facilitatorReference: ref }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save')
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete “${theme.title}”?`)) return
    setBusy(true)
    await fetch(`/api/quadrant/projects/${projectId}/themes/${theme.id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function move(dir: -1 | 1) {
    setBusy(true)
    // Reorder is computed against the current list; the parent passes index/total.
    await fetch(`/api/quadrant/projects/${projectId}/themes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: reorderedIds(theme.id, index, dir) }),
    })
    router.refresh()
  }

  if (!editing) {
    return (
      <div className="p-4 bg-surface border border-line rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{theme.title}</p>
            {theme.items.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1">
                {theme.items.map((it, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-ink-soft bg-canvas border border-line rounded-full px-2 py-0.5"
                  >
                    {it}
                  </li>
                ))}
              </ul>
            )}
            {theme.facilitatorReference && (
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Reference: <span className="font-medium">{quadrantLabels[theme.facilitatorReference]}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex gap-1">
              <button
                aria-label="Move up"
                disabled={busy || index === 0}
                onClick={() => move(-1)}
                className="w-7 h-7 flex items-center justify-center rounded border border-line text-ink-muted hover:text-ink hover:border-ink disabled:opacity-25 disabled:pointer-events-none"
              >
                ↑
              </button>
              <button
                aria-label="Move down"
                disabled={busy || index === total - 1}
                onClick={() => move(1)}
                className="w-7 h-7 flex items-center justify-center rounded border border-line text-ink-muted hover:text-ink hover:border-ink disabled:opacity-25 disabled:pointer-events-none"
              >
                ↓
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="text-xs font-medium text-ink-soft hover:text-ink">
                Edit
              </button>
              <button onClick={remove} disabled={busy} className="text-xs font-medium text-fail hover:opacity-80">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-surface border border-ink rounded-lg space-y-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} autoFocus className={inputCls} />
      <label className="block">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
          Items (one per line)
        </span>
        <textarea
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          rows={4}
          className={`${inputCls} resize-y`}
        />
      </label>
      <RefSelect value={ref} quadrantLabels={quadrantLabels} onChange={setRef} />
      {error && <p className="text-sm text-fail">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy || !title.trim()}
          className="px-3 py-1.5 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => {
            setEditing(false)
            setTitle(theme.title)
            setItemsText(itemsToText(theme.items))
            setRef(theme.facilitatorReference)
          }}
          className="px-3 py-1.5 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// The reorder helper needs the current ordered id list. We recompute it lazily
// from the DOM-independent index by reading the rendered order via a data map the
// parent maintains; simpler: the parent passes the full ordered id list down.
let CURRENT_ORDER: string[] = []
function reorderedIds(id: string, index: number, dir: -1 | 1): string[] {
  const ids = [...CURRENT_ORDER]
  const to = index + dir
  if (to < 0 || to >= ids.length) return ids
  ;[ids[index], ids[to]] = [ids[to], ids[index]]
  return ids
}

export function SetupView({
  projectId,
  name,
  initialThemes,
  quadrantLabels,
}: {
  projectId: string
  name: string
  initialThemes: EditableTheme[]
  quadrantLabels: Record<QuadrantKey, string>
}) {
  const router = useRouter()
  CURRENT_ORDER = initialThemes.map((t) => t.id)

  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newItems, setNewItems] = useState('')
  const [newRef, setNewRef] = useState<QuadrantKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function addTheme(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quadrant/projects/${projectId}/themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          title: newTitle.trim(),
          items: textToItems(newItems),
          facilitatorReference: newRef,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not add theme')
      setNewTitle('')
      setNewItems('')
      setNewRef(null)
      setAdding(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add theme')
    } finally {
      setBusy(false)
    }
  }

  async function importSeed() {
    if (!confirm('Load the example template? A set of sample themes will be added — edit or delete them freely.')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quadrant/projects/${projectId}/themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import-seed' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not import seed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import seed')
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quadrant/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not start')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted">Themes ({initialThemes.length})</h2>
        <div className="flex items-center gap-2">
          {initialThemes.length === 0 && (
            <button
              onClick={importSeed}
              disabled={busy}
              className="px-3 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors disabled:opacity-40"
            >
              Load example template
            </button>
          )}
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="px-3 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
            >
              + Add theme
            </button>
          )}
        </div>
      </div>

      {adding && (
        <form onSubmit={addTheme} className="p-4 bg-surface border border-ink rounded-lg space-y-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={300}
            autoFocus
            placeholder="Theme title"
            className={inputCls}
          />
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
              Items (one per line)
            </span>
            <textarea
              value={newItems}
              onChange={(e) => setNewItems(e.target.value)}
              rows={3}
              placeholder="Live phone-booth availability&#10;Advance space intelligence"
              className={`${inputCls} resize-y`}
            />
          </label>
          <RefSelect value={newRef} quadrantLabels={quadrantLabels} onChange={setNewRef} />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !newTitle.trim()}
              className="px-3 py-1.5 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40"
            >
              {busy ? 'Adding…' : 'Add theme'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {initialThemes.length === 0 ? (
        <p className="text-ink-muted text-sm py-8 text-center bg-surface rounded-lg border border-line">
          No themes yet. Load the example template to see the format, or add your own.
        </p>
      ) : (
        <div className="space-y-2.5">
          {initialThemes.map((t, i) => (
            <ThemeCard
              key={t.id}
              projectId={projectId}
              theme={t}
              index={i}
              total={initialThemes.length}
              quadrantLabels={quadrantLabels}
            />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-fail">{error}</p>}

      <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink mb-1">Share with participants</p>
          <ShareLink path={`/quadrant/${projectId}`} />
          <p className="text-xs text-ink-muted mt-1">
            Anyone signed in can join once you start. They&apos;ll each place every theme.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1 border-t border-accent/30">
          <button
            onClick={start}
            disabled={busy || initialThemes.length === 0}
            className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {busy ? 'Starting…' : `Start workshop with ${initialThemes.length} ${initialThemes.length === 1 ? 'theme' : 'themes'} →`}
          </button>
          {initialThemes.length === 0 && <span className="text-xs text-ink-soft">Add a theme first.</span>}
        </div>
      </div>

      <p className="sr-only">{name}</p>
    </div>
  )
}
