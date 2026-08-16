'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  QUADRANT_KEYS,
  QUADRANT_MEANING,
  type AxisLabels,
  type DecidedTheme,
  type DecisionLogEntry,
  type QuadrantKey,
} from '@/lib/quadrant-model'
import { QuadrantFrame } from './QuadrantFrame'

const UNPLACED = 'unplaced'

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

// ── One card on the decided board ───────────────────────────────────────────────

function DecidedCard({
  theme,
  votedQuadrant,
  quadrantLabels,
  canManage,
  onEdit,
}: {
  theme: DecidedTheme
  /** Where the group's vote put it, for the "moved" badge. */
  votedQuadrant: QuadrantKey | null
  quadrantLabels: Record<QuadrantKey, string>
  canManage: boolean
  onEdit: () => void
}) {
  const [open, setOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: theme.id,
    disabled: !canManage,
  })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }

  const hasItems = theme.items.length > 0
  const added = theme.origin === 'discussion'
  // A move only counts against a theme that was actually voted on.
  const moved = !added && votedQuadrant !== theme.quadrantKey

  return (
    <div ref={setNodeRef} style={style} className="bg-surface border border-line rounded-md">
      <div className="flex items-start gap-1 px-1.5 py-1">
        {canManage && (
          <span
            {...attributes}
            {...listeners}
            aria-hidden
            title="Drag to another quadrant"
            className="cursor-grab active:cursor-grabbing touch-none select-none text-ink-muted hover:text-ink leading-none pt-1"
          >
            ⠿
          </span>
        )}
        <button
          onClick={() => hasItems && setOpen((o) => !o)}
          aria-expanded={hasItems ? open : undefined}
          className={`min-w-0 flex-1 text-left ${hasItems ? '' : 'cursor-default'}`}
        >
          <span className="block text-[11px] sm:text-xs font-medium text-ink leading-tight">{theme.title}</span>
          {(added || moved || theme.derivedFromTitle) && (
            <span className="mt-0.5 flex flex-wrap items-center gap-1">
              {added && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-ink bg-accent/30 rounded-full px-1.5 py-0.5">
                  Added
                </span>
              )}
              {moved && (
                <span
                  title={`The group voted this into ${votedQuadrant ? quadrantLabels[votedQuadrant] : 'no quadrant'}`}
                  className="text-[9px] font-medium text-ink-muted"
                >
                  moved from {votedQuadrant ? quadrantLabels[votedQuadrant] : 'unplaced'}
                </span>
              )}
              {theme.derivedFromTitle && (
                <span className="text-[9px] text-ink-muted italic">split from {theme.derivedFromTitle}</span>
              )}
            </span>
          )}
        </button>
        {hasItems && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 text-[10px] text-ink-muted hover:text-ink px-0.5"
            aria-label={open ? 'Hide features' : 'Show features'}
          >
            {open ? '−' : '+'}
          </button>
        )}
        {canManage && (
          <button
            onClick={onEdit}
            title="Edit this theme's scope"
            aria-label="Edit this theme's scope"
            className="shrink-0 text-[11px] text-ink-muted hover:text-ink px-0.5 leading-none"
          >
            ✎
          </button>
        )}
      </div>
      {open && hasItems && (
        <ul className="px-2.5 pb-1.5 list-disc list-inside space-y-0.5">
          {theme.items.map((it, i) => (
            <li key={i} className="text-[10px] text-ink-soft leading-snug">
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Scope editor (pencil) ───────────────────────────────────────────────────────

function ScopeEditor({
  theme,
  onSave,
  onDelete,
  onCancel,
  busy,
}: {
  theme: DecidedTheme
  onSave: (data: { title: string; items: string[]; note: string }) => void
  onDelete: () => void
  onCancel: () => void
  busy: boolean
}) {
  const [title, setTitle] = useState(theme.title)
  const [itemsText, setItemsText] = useState(itemsToText(theme.items))
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="rounded-lg border border-accent/50 bg-accent/10 p-4 space-y-3">
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">Theme</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className={inputCls} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
          Features in scope — one per line
        </label>
        <textarea
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          rows={5}
          className={`${inputCls} font-mono text-xs`}
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
          Why it changed — optional, shown in the change log
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          placeholder="e.g. narrowed to self-serve only after the discussion"
          className={inputCls}
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-accent/30">
        <button
          onClick={() => onSave({ title: title.trim(), items: textToItems(itemsText), note: note.trim() })}
          disabled={busy || title.trim().length === 0}
          className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save scope'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink"
        >
          Cancel
        </button>
        <span className="flex-1" />
        {confirmDelete ? (
          <span className="flex items-center gap-2">
            <span className="text-xs text-ink-soft">Drop from the decided board?</span>
            <button
              onClick={onDelete}
              disabled={busy}
              className="px-3 py-1.5 bg-fail text-white text-xs font-semibold rounded-md hover:opacity-90 disabled:opacity-40"
            >
              Drop it
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-ink-muted hover:text-ink"
            >
              Keep
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-fail hover:underline">
            Drop theme
          </button>
        )}
      </div>
      <p className="text-[11px] text-ink-muted">
        Edits only affect the decided board — the frozen vote result keeps the original wording.
      </p>
    </div>
  )
}

// ── Add-a-theme form ────────────────────────────────────────────────────────────

function AddThemeForm({
  quadrantKey,
  quadrantLabels,
  siblings,
  onAdd,
  onCancel,
  busy,
}: {
  quadrantKey: QuadrantKey
  quadrantLabels: Record<QuadrantKey, string>
  siblings: DecidedTheme[]
  onAdd: (data: { title: string; items: string[]; derivedFromId: string | null; note: string }) => void
  onCancel: () => void
  busy: boolean
}) {
  const [title, setTitle] = useState('')
  const [itemsText, setItemsText] = useState('')
  const [derivedFromId, setDerivedFromId] = useState('')
  const [note, setNote] = useState('')

  return (
    <div className="rounded-lg border border-accent/50 bg-accent/10 p-4 space-y-3">
      <p className="text-sm font-semibold text-ink">
        New theme in <span className="font-bold">{quadrantLabels[quadrantKey]}</span>
      </p>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">Theme</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          autoFocus
          placeholder="What came out of the discussion"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
          Features in scope — one per line
        </label>
        <textarea
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          rows={4}
          className={`${inputCls} font-mono text-xs`}
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
          Split out of — optional
        </label>
        <select value={derivedFromId} onChange={(e) => setDerivedFromId(e.target.value)} className={inputCls}>
          <option value="">Not a split — brand new theme</option>
          {siblings.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
          Why — optional, shown in the change log
        </label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={inputCls} />
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-accent/30">
        <button
          onClick={() =>
            onAdd({
              title: title.trim(),
              items: textToItems(itemsText),
              derivedFromId: derivedFromId || null,
              note: note.trim(),
            })
          }
          disabled={busy || title.trim().length === 0}
          className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Adding…' : 'Add theme'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Droppable quadrant ──────────────────────────────────────────────────────────

function DroppableQuadrant({
  quadrantKey,
  label,
  count,
  canManage,
  onAdd,
  children,
}: {
  quadrantKey: QuadrantKey
  label: string
  count: number
  canManage: boolean
  onAdd: () => void
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrantKey, disabled: !canManage })
  return (
    <div
      ref={setNodeRef}
      className={`h-full min-h-[140px] sm:min-h-[180px] rounded-lg border-2 p-2.5 transition-colors ${
        isOver ? 'border-ink bg-accent/15' : 'border-line bg-canvas'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-ink leading-tight">{label}</span>
        {count > 0 && <span className="text-[10px] text-ink-muted">{count}</span>}
      </div>
      <p className="text-[10px] text-ink-muted leading-snug mt-0.5 mb-2">{QUADRANT_MEANING[quadrantKey]}</p>
      <div className="space-y-1">{children}</div>
      {canManage && (
        <button
          onClick={onAdd}
          className="mt-1.5 w-full text-[10px] text-ink-muted hover:text-ink border border-dashed border-line hover:border-ink rounded py-1"
        >
          + Add theme here
        </button>
      )}
    </div>
  )
}

// ── Change log ──────────────────────────────────────────────────────────────────

function ChangeLog({
  log,
  quadrantLabels,
}: {
  log: DecisionLogEntry[]
  quadrantLabels: Record<QuadrantKey, string>
}) {
  const [open, setOpen] = useState(false)
  const q = (k: QuadrantKey | null) => (k ? quadrantLabels[k] : 'unplaced')

  function describe(e: DecisionLogEntry): string {
    switch (e.kind) {
      case 'seeded':
        return e.note
      case 'moved':
        return `Moved “${e.themeTitle}” from ${q(e.fromQuadrant)} to ${q(e.toQuadrant)}.`
      case 'added':
        return `Added “${e.themeTitle}” to ${q(e.toQuadrant)}.`
      case 'removed':
        return `Dropped “${e.themeTitle}” from ${q(e.fromQuadrant)}.`
      case 'rescoped':
        return `Re-scoped “${e.themeTitle}”.`
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-sm font-bold uppercase tracking-widest text-ink-muted hover:text-ink"
      >
        Change log ({log.length}) {open ? '−' : '+'}
      </button>
      {open && (
        <ol className="mt-3 space-y-2">
          {log.map((e) => (
            <li key={e.id} className="text-xs text-ink-soft leading-snug">
              <span className="text-ink">{describe(e)}</span>
              {e.kind !== 'seeded' && e.note && <span className="text-ink-muted"> {e.note}</span>}
              <span className="block text-[10px] text-ink-muted mt-0.5">
                {e.actorName} · {new Date(e.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
          {log.length === 0 && <li className="text-xs text-ink-muted">Nothing has changed yet.</li>}
        </ol>
      )}
    </div>
  )
}

// ── The board ───────────────────────────────────────────────────────────────────

export function DecidedBoard({
  projectId,
  axisLabels,
  initialThemes,
  votedQuadrantByThemeId,
  log,
  canManage,
  frozenAt,
}: {
  projectId: string
  axisLabels: AxisLabels
  initialThemes: DecidedTheme[]
  /** sourceThemeId → the quadrant the group voted it into, for "moved" badges. */
  votedQuadrantByThemeId: Record<string, QuadrantKey | null>
  log: DecisionLogEntry[]
  canManage: boolean
  frozenAt: string
}) {
  const router = useRouter()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const [themes, setThemes] = useState<DecidedTheme[]>(initialThemes)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<QuadrantKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy

  // Re-sync when the server sends fresh data (after router.refresh()), but never
  // mid-save — that would clobber the optimistic state with a stale snapshot.
  useEffect(() => {
    if (!busyRef.current) setThemes(initialThemes)
  }, [initialThemes])

  const call = useCallback(
    async (url: string, init: RequestInit): Promise<boolean> => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save')
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save')
        return false
      } finally {
        setBusy(false)
      }
    },
    []
  )

  const move = useCallback(
    async (decidedId: string, quadrantKey: QuadrantKey | null) => {
      const before = themes
      setThemes((prev) => prev.map((t) => (t.id === decidedId ? { ...t, quadrantKey } : t)))
      const ok = await call(`/api/quadrant/projects/${projectId}/decisions/themes/${decidedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'move', quadrantKey }),
      })
      if (!ok) setThemes(before)
      else router.refresh()
    },
    [call, projectId, router, themes]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return
      const target = String(over.id)
      if (target === UNPLACED) {
        void move(String(active.id), null)
      } else if ((QUADRANT_KEYS as readonly string[]).includes(target)) {
        void move(String(active.id), target as QuadrantKey)
      }
    },
    [move]
  )

  async function saveScope(decidedId: string, data: { title: string; items: string[]; note: string }) {
    const ok = await call(`/api/quadrant/projects/${projectId}/decisions/themes/${decidedId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'rescope', ...data }),
    })
    if (ok) {
      setThemes((prev) =>
        prev.map((t) => (t.id === decidedId ? { ...t, title: data.title, items: data.items } : t))
      )
      setEditingId(null)
      router.refresh()
    }
  }

  async function dropTheme(decidedId: string) {
    const ok = await call(`/api/quadrant/projects/${projectId}/decisions/themes/${decidedId}`, {
      method: 'DELETE',
    })
    if (ok) {
      setThemes((prev) => prev.filter((t) => t.id !== decidedId))
      setEditingId(null)
      router.refresh()
    }
  }

  async function addTheme(
    quadrantKey: QuadrantKey,
    data: { title: string; items: string[]; derivedFromId: string | null; note: string }
  ) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quadrant/projects/${projectId}/decisions/themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, quadrantKey }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not add the theme')
      const { theme } = (await res.json()) as { theme: DecidedTheme }
      setThemes((prev) => [...prev, theme])
      setAddingTo(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the theme')
    } finally {
      setBusy(false)
    }
  }

  const editing = editingId ? (themes.find((t) => t.id === editingId) ?? null) : null
  const unplaced = themes.filter((t) => t.quadrantKey === null)
  const votedFor = (t: DecidedTheme) =>
    t.sourceThemeId ? (votedQuadrantByThemeId[t.sourceThemeId] ?? null) : null
  const movedCount = themes.filter((t) => t.origin === 'workshop' && votedFor(t) !== t.quadrantKey).length
  const addedCount = themes.filter((t) => t.origin === 'discussion').length

  const { setNodeRef: setTrayRef, isOver: trayOver } = useDroppable({ id: UNPLACED, disabled: !canManage })

  return (
    <section>
      <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted">Decided</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {canManage
              ? 'Drag a theme to move it, ✎ to change its scope, or add what came out of the discussion. Every change is saved and logged.'
              : 'Where the themes stand after the discussion. Only the facilitator can change this.'}
          </p>
        </div>
        <p className="text-[11px] text-ink-muted">
          Seeded from the vote frozen {new Date(frozenAt).toLocaleDateString()}
          {movedCount > 0 && ` · ${movedCount} moved`}
          {addedCount > 0 && ` · ${addedCount} added`}
        </p>
      </div>

      {error && <div className="mb-3 p-3 bg-fail-soft border border-fail-line rounded-md text-fail text-sm">{error}</div>}

      {editing && (
        <div className="mb-4">
          <ScopeEditor
            theme={editing}
            busy={busy}
            onSave={(data) => void saveScope(editing.id, data)}
            onDelete={() => void dropTheme(editing.id)}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {addingTo && (
        <div className="mb-4">
          <AddThemeForm
            quadrantKey={addingTo}
            quadrantLabels={axisLabels.quadrants}
            siblings={themes}
            busy={busy}
            onAdd={(data) => void addTheme(addingTo, data)}
            onCancel={() => setAddingTo(null)}
          />
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="rounded-xl border border-line bg-surface p-3 sm:p-5">
          <QuadrantFrame
            axisLabels={axisLabels}
            renderQuadrant={(key) => {
              const here = themes.filter((t) => t.quadrantKey === key)
              return (
                <DroppableQuadrant
                  quadrantKey={key}
                  label={axisLabels.quadrants[key]}
                  count={here.length}
                  canManage={canManage}
                  onAdd={() => {
                    setEditingId(null)
                    setAddingTo(key)
                  }}
                >
                  {here.map((t) => (
                    <DecidedCard
                      key={t.id}
                      theme={t}
                      votedQuadrant={votedFor(t)}
                      quadrantLabels={axisLabels.quadrants}
                      canManage={canManage}
                      onEdit={() => {
                        setAddingTo(null)
                        setEditingId(t.id)
                      }}
                    />
                  ))}
                </DroppableQuadrant>
              )
            }}
          />

          {/* Themes with no home yet: ties, no-votes, or dragged back out. */}
          {(unplaced.length > 0 || canManage) && (
            <div
              ref={setTrayRef}
              className={`mt-4 rounded-lg border-2 border-dashed p-3 transition-colors ${
                trayOver ? 'border-ink bg-accent/15' : 'border-line bg-canvas'
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1.5">
                Unplaced {unplaced.length > 0 && `(${unplaced.length})`}
              </p>
              {unplaced.length === 0 ? (
                <p className="text-[11px] text-ink-muted">
                  Everything has a quadrant. Drag a theme here to park it.
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-ink-muted mb-2">
                    The group tied or didn&apos;t vote on these — decide where they belong.
                  </p>
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {unplaced.map((t) => (
                      <DecidedCard
                        key={t.id}
                        theme={t}
                        votedQuadrant={votedFor(t)}
                        quadrantLabels={axisLabels.quadrants}
                        canManage={canManage}
                        onEdit={() => {
                          setAddingTo(null)
                          setEditingId(t.id)
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DndContext>

      <ChangeLog log={log} quadrantLabels={axisLabels.quadrants} />
    </section>
  )
}
