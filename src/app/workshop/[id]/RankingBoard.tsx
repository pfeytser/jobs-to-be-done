'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface BoardCard {
  id: string
  title: string
  description: string
  category: string
}

export interface ChoiceOption {
  key: string
  label: string
}

export interface BoardColumn {
  /** Category key sent to the API (empty string for the combined round). */
  category: string
  /** Dimension key sent to the API (empty string in single mode). */
  dimension: string
  type: 'rank' | 'choice'
  /** Column header (dimension name in multi mode; blank in single mode). */
  label: string
  hint?: string
  cards: BoardCard[]
  /** choice only */
  options?: ChoiceOption[]
  initialChoices?: Record<string, string>
}

type Layout = 'grid' | 'combined' | 'multi'

function columnId(col: BoardColumn) {
  return `${col.category} ${col.dimension}`
}

// ── Rank column (drag to order) ────────────────────────────────────────────────

type MoveKind = 'top' | 'up' | 'down' | 'bottom'

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // Stop dnd-kit from starting a drag when the control is pressed.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="w-6 h-5 flex items-center justify-center rounded text-ink-muted hover:text-ink hover:bg-canvas border border-transparent hover:border-line disabled:opacity-25 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  )
}

function SortableCard({
  card,
  index,
  total,
  showBadge,
  onMove,
}: {
  card: BoardCard
  index: number
  total: number
  showBadge: boolean
  onMove: (from: number, kind: MoveKind) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const isFirst = index === 0
  const isLast = index === total - 1
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-3 p-3 bg-surface border border-line rounded-lg hover:border-ink transition-colors"
    >
      <span className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-md bg-canvas border border-line text-xs font-bold text-ink-soft">
        {index + 1}
      </span>
      {/* The content is the drag handle. */}
      <div
        {...attributes}
        {...listeners}
        className="min-w-0 flex-1 cursor-grab active:cursor-grabbing touch-none select-none"
      >
        {showBadge && card.category && (
          <span className="inline-block mb-1 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
            {card.category}
          </span>
        )}
        <p className="text-sm font-semibold text-ink leading-snug">{card.title}</p>
        {card.description && <p className="text-xs text-ink-muted mt-0.5 leading-snug">{card.description}</p>}
      </div>
      {/* Reorder controls (in addition to drag-and-drop). */}
      <div className="shrink-0 flex flex-col gap-0.5">
        <MoveButton label="Move to top" disabled={isFirst} onClick={() => onMove(index, 'top')}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 3h9M4 11l4-4 4 4" />
          </svg>
        </MoveButton>
        <MoveButton label="Move up" disabled={isFirst} onClick={() => onMove(index, 'up')}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4-4 4 4" />
          </svg>
        </MoveButton>
        <MoveButton label="Move down" disabled={isLast} onClick={() => onMove(index, 'down')}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
          </svg>
        </MoveButton>
        <MoveButton label="Move to bottom" disabled={isLast} onClick={() => onMove(index, 'bottom')}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5l4 4 4-4M3.5 13h9" />
          </svg>
        </MoveButton>
      </div>
    </li>
  )
}

function RankColumn({
  workshopId,
  column,
  showBadge,
  onSavingChange,
}: {
  workshopId: string
  column: BoardColumn
  showBadge: boolean
  onSavingChange: (saving: boolean) => void
}) {
  const [cards, setCards] = useState<BoardCard[]>(column.cards)
  const cardsRef = useRef(cards)
  cardsRef.current = cards

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const persist = useCallback(
    async (order: string[]) => {
      onSavingChange(true)
      try {
        await fetch(`/api/workshop/sessions/${workshopId}/rankings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            kind: 'rank',
            category: column.category,
            dimension: column.dimension,
            orderedItemIds: order,
          }),
        })
      } catch {
        // Transient — the next drag or the submit call will re-persist.
      } finally {
        onSavingChange(false)
      }
    },
    [workshopId, column.category, column.dimension, onSavingChange]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      setCards((prev) => {
        const next = arrayMove(
          prev,
          prev.findIndex((c) => c.id === active.id),
          prev.findIndex((c) => c.id === over.id)
        )
        cardsRef.current = next
        void persist(next.map((c) => c.id))
        return next
      })
    },
    [persist]
  )

  const moveCard = useCallback(
    (from: number, kind: MoveKind) => {
      setCards((prev) => {
        const to = kind === 'top' ? 0 : kind === 'bottom' ? prev.length - 1 : kind === 'up' ? from - 1 : from + 1
        if (to < 0 || to >= prev.length || to === from) return prev
        const next = arrayMove(prev, from, to)
        cardsRef.current = next
        void persist(next.map((c) => c.id))
        return next
      })
    },
    [persist]
  )

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {cards.map((card, i) => (
            <SortableCard key={card.id} card={card} index={i} total={cards.length} showBadge={showBadge} onMove={moveCard} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

// ── Choice column (label each item) ─────────────────────────────────────────────

function ChoiceColumn({
  workshopId,
  column,
  onSavingChange,
  onRemainingChange,
}: {
  workshopId: string
  column: BoardColumn
  onSavingChange: (saving: boolean) => void
  onRemainingChange: (id: string, remaining: number) => void
}) {
  const options = column.options ?? []
  const [choices, setChoices] = useState<Record<string, string>>(column.initialChoices ?? {})
  const choicesRef = useRef(choices)
  choicesRef.current = choices

  const persist = useCallback(
    async (next: Record<string, string>) => {
      onSavingChange(true)
      try {
        await fetch(`/api/workshop/sessions/${workshopId}/rankings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            kind: 'choice',
            category: column.category,
            dimension: column.dimension,
            choices: next,
          }),
        })
      } catch {
        // Transient — a later selection or submit re-persists.
      } finally {
        onSavingChange(false)
      }
    },
    [workshopId, column.category, column.dimension, onSavingChange]
  )

  function select(itemId: string, optionKey: string) {
    setChoices((prev) => {
      const next = { ...prev, [itemId]: optionKey }
      choicesRef.current = next
      onRemainingChange(columnId(column), column.cards.filter((c) => !next[c.id]).length)
      void persist(next)
      return next
    })
  }

  return (
    <ul className="space-y-2">
      {column.cards.map((card) => {
        const chosen = choices[card.id]
        return (
          <li
            key={card.id}
            className={`p-3 rounded-lg border transition-colors ${
              chosen ? 'bg-surface border-line' : 'bg-accent-wash/50 border-accent'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ink leading-snug">{card.title}</p>
              {!chosen && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-soft bg-accent/30 border border-accent/50 rounded-full px-2 py-0.5">
                  Pick one
                </span>
              )}
            </div>
            {card.description && <p className="text-xs text-ink-muted mt-0.5 leading-snug">{card.description}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((opt) => {
                const active = chosen === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => select(card.id, opt.key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-ink text-white border-ink'
                        : 'bg-canvas text-ink-soft border-line hover:border-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ── Board ────────────────────────────────────────────────────────────────────

function DimensionBoard({
  workshopId,
  column,
  showBadge,
  onSavingChange,
  onRemainingChange,
}: {
  workshopId: string
  column: BoardColumn
  showBadge: boolean
  onSavingChange: (saving: boolean) => void
  onRemainingChange: (id: string, remaining: number) => void
}) {
  return (
    <div className="flex flex-col">
      {column.label && (
        <h4 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-1 px-1">{column.label}</h4>
      )}
      {column.hint && <p className="text-xs text-ink-muted mb-3 px-1">{column.hint}</p>}
      {!column.hint && column.label && <div className="mb-3" />}
      {column.type === 'choice' ? (
        <ChoiceColumn
          workshopId={workshopId}
          column={column}
          onSavingChange={onSavingChange}
          onRemainingChange={onRemainingChange}
        />
      ) : (
        <RankColumn workshopId={workshopId} column={column} showBadge={showBadge} onSavingChange={onSavingChange} />
      )}
    </div>
  )
}

export function RankingBoard({
  workshopId,
  columns,
  layout,
}: {
  workshopId: string
  columns: BoardColumn[]
  layout: Layout
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Choice columns report how many items still need a label so we can gate the
  // submit button and tell the participant exactly how much is left.
  const [remaining, setRemaining] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      columns
        .filter((c) => c.type === 'choice')
        .map((c) => [columnId(c), c.cards.filter((card) => !(c.initialChoices ?? {})[card.id]).length])
    )
  )
  const onRemainingChange = useCallback((id: string, value: number) => {
    setRemaining((prev) => (prev[id] === value ? prev : { ...prev, [id]: value }))
  }, [])
  const totalRemaining = Object.values(remaining).reduce((sum, n) => sum + n, 0)
  const allChoicesDone = totalRemaining === 0

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/workshop/sessions/${workshopId}/rankings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not submit')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit. Please try again.')
      setSubmitting(false)
    }
  }

  const instructions =
    layout === 'combined'
      ? 'Drag cards so the highest priority sits at the top. This is the final combined list.'
      : layout === 'multi'
        ? 'For each category, drag to rank one axis and pick a label per item on the other.'
        : 'Drag cards so the highest priority sits at the top. Rank each category independently.'

  // Group columns by category for the multi layout.
  const groups = useMemo(() => {
    const order: string[] = []
    const byCat = new Map<string, BoardColumn[]>()
    for (const col of columns) {
      if (!byCat.has(col.category)) {
        byCat.set(col.category, [])
        order.push(col.category)
      }
      byCat.get(col.category)!.push(col)
    }
    return order.map((cat) => ({ category: cat, cols: byCat.get(cat)! }))
  }, [columns])

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-sm text-ink-soft">{instructions}</p>
        <div className="flex items-center gap-3">
          {saving ? (
            <span className="text-xs text-ink-muted">Saving…</span>
          ) : (
            <span className="text-xs text-pass">✓ Saved</span>
          )}
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleSubmit}
              disabled={submitting || !allChoicesDone}
              className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {submitting ? 'Submitting…' : 'Submit my ranking'}
            </button>
            {!allChoicesDone && (
              <span className="text-xs text-ink-soft">
                Label {totalRemaining} more {totalRemaining === 1 ? 'item' : 'items'} to submit
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-fail-soft border border-fail-line rounded-md text-fail text-sm">{error}</div>
      )}

      {layout === 'combined' && (
        <div className="max-w-2xl">
          {columns.map((col) => (
            <DimensionBoard
              key={columnId(col)}
              workshopId={workshopId}
              column={col}
              showBadge
              onSavingChange={setSaving}
              onRemainingChange={onRemainingChange}
            />
          ))}
        </div>
      )}

      {layout === 'grid' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((col) => (
            <DimensionBoard
              key={columnId(col)}
              workshopId={workshopId}
              column={col}
              showBadge={false}
              onSavingChange={setSaving}
              onRemainingChange={onRemainingChange}
            />
          ))}
        </div>
      )}

      {layout === 'multi' && (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.category}>
              <h3 className="text-base font-semibold text-ink mb-3 pb-1 border-b border-line">{group.category}</h3>
              <div className="grid gap-6 md:grid-cols-2">
                {group.cols.map((col) => (
                  <DimensionBoard
                    key={columnId(col)}
                    workshopId={workshopId}
                    column={col}
                    showBadge={false}
                    onSavingChange={setSaving}
                    onRemainingChange={onRemainingChange}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
