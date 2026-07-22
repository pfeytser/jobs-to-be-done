'use client'

import { useState, useRef, useCallback } from 'react'
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

export interface BoardColumn {
  /** Category key sent to the API (empty string for the combined round). */
  category: string
  label: string
  cards: BoardCard[]
}

function SortableCard({ card, index, showBadge }: { card: BoardCard; index: number; showBadge: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group flex items-start gap-3 p-3 bg-surface border border-line rounded-lg cursor-grab active:cursor-grabbing hover:border-ink touch-none select-none transition-colors"
    >
      <span className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-md bg-canvas border border-line text-xs font-bold text-ink-soft">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        {showBadge && card.category && (
          <span className="inline-block mb-1 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
            {card.category}
          </span>
        )}
        <p className="text-sm font-semibold text-ink leading-snug">{card.title}</p>
        {card.description && <p className="text-xs text-ink-muted mt-0.5 leading-snug">{card.description}</p>}
      </div>
      <svg className="shrink-0 w-4 h-4 text-ink-muted/50 group-hover:text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
      </svg>
    </li>
  )
}

function Column({
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
          body: JSON.stringify({ action: 'save', category: column.category, orderedItemIds: order }),
        })
      } catch {
        // Transient — the next drag or the submit call will re-persist.
      } finally {
        onSavingChange(false)
      }
    },
    [workshopId, column.category, onSavingChange]
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

  return (
    <div className="flex flex-col">
      {column.label && (
        <h3 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3 px-1">{column.label}</h3>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {cards.map((card, i) => (
              <SortableCard key={card.id} card={card} index={i} showBadge={showBadge} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export function RankingBoard({
  workshopId,
  columns,
  combined,
}: {
  workshopId: string
  columns: BoardColumn[]
  /** True for the single merged round-2 list (shows category badges, one column). */
  combined: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-sm text-ink-soft">
          Drag cards so the <strong className="text-ink">highest priority sits at the top</strong>.
          {combined ? ' This is the final combined list.' : ' Rank each category independently.'}
        </p>
        <div className="flex items-center gap-3">
          {saving ? (
            <span className="text-xs text-ink-muted">Saving…</span>
          ) : (
            <span className="text-xs text-pass">✓ Saved</span>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {submitting ? 'Submitting…' : 'Submit my ranking'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-fail-soft border border-fail-line rounded-md text-fail text-sm">{error}</div>
      )}

      {combined ? (
        <div className="max-w-2xl">
          {columns.map((col) => (
            <Column
              key={col.category || 'combined'}
              workshopId={workshopId}
              column={col}
              showBadge
              onSavingChange={setSaving}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((col) => (
            <Column
              key={col.category}
              workshopId={workshopId}
              column={col}
              showBadge={false}
              onSavingChange={setSaving}
            />
          ))}
        </div>
      )}
    </div>
  )
}
