'use client'

import { useCallback, useRef, useState } from 'react'
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
import { QUADRANT_KEYS, type AxisLabels, type QuadrantKey } from '@/lib/quadrant-model'
import { QuadrantFrame } from './QuadrantFrame'

export interface ActivityTheme {
  id: string
  title: string
  items: string[]
}

// Subtle dotted "canvas" background to match the storyboard feel.
const DOTTED: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(1,62,63,0.12) 1px, transparent 1px)',
  backgroundSize: '16px 16px',
}

// ── The single theme card currently being placed (draggable) ─────────────────────

function CurrentCard({ theme }: { theme: ActivityTheme }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: theme.id })
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div className="mx-auto w-full max-w-md">
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none select-none bg-surface border border-line rounded-lg shadow-sm p-4"
      >
        <p className="text-center text-lg font-semibold text-ink">{theme.title}</p>
        {theme.items.length > 0 && (
          <ul className="mt-2 space-y-0.5 list-disc list-inside">
            {theme.items.map((it, i) => (
              <li key={i} className="text-sm text-ink-soft leading-snug">
                {it}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── A placed theme chip (click to send back to the top) ──────────────────────────

function PlacedChip({ theme, onBringBack }: { theme: ActivityTheme; onBringBack: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: theme.id })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 bg-surface border border-line rounded-md">
      <span
        {...attributes}
        {...listeners}
        aria-hidden
        className="cursor-grab active:cursor-grabbing touch-none select-none text-ink-muted hover:text-ink pl-1.5 leading-none"
        title="Drag to another quadrant"
      >
        ⠿
      </span>
      <button
        onClick={onBringBack}
        title="Click to move back to the top and re-place"
        className="min-w-0 flex-1 text-left py-1 pr-2"
      >
        <span className="block text-xs font-medium text-ink leading-tight truncate">{theme.title}</span>
      </button>
    </div>
  )
}

// ── A large droppable quadrant ────────────────────────────────────────────────────

function QuadrantCell({
  quadrantKey,
  count,
  children,
}: {
  quadrantKey: QuadrantKey
  count: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrantKey })
  return (
    <div
      ref={setNodeRef}
      className={`h-full min-h-[200px] sm:min-h-[260px] rounded-lg border-2 p-2.5 transition-colors ${
        isOver ? 'border-ink bg-accent/15' : 'border-line bg-surface/70'
      }`}
    >
      {/* Intentionally no text inside the box — orientation comes from the axis
          labels on the edges; cards would otherwise overlap it. */}
      {count > 0 && (
        <div className="flex justify-end mb-1.5">
          <span className="text-[10px] text-ink-muted">{count}</span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

// ── The activity ─────────────────────────────────────────────────────────────────

export function PlacementActivity({
  projectId,
  themes,
  axisLabels,
  initialPlacements,
}: {
  projectId: string
  themes: ActivityTheme[]
  axisLabels: AxisLabels
  initialPlacements: Record<string, QuadrantKey | null>
}) {
  const router = useRouter()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const themeById = new Map(themes.map((t) => [t.id, t]))

  const [placements, setPlacements] = useState<Record<string, QuadrantKey | null>>(() => {
    const base: Record<string, QuadrantKey | null> = {}
    for (const t of themes) base[t.id] = initialPlacements[t.id] ?? null
    return base
  })
  // The one theme shown at the top. Defaults to the first unplaced theme.
  const [currentId, setCurrentId] = useState<string | null>(
    () => themes.find((t) => !(initialPlacements[t.id] ?? null))?.id ?? null
  )
  const currentIdRef = useRef(currentId)
  currentIdRef.current = currentId

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const persist = useCallback(
    async (themeId: string, key: QuadrantKey | null) => {
      setSaving(true)
      try {
        const res = await fetch(`/api/quadrant/projects/${projectId}/placements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId, quadrantKey: key }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save')
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save placement')
      } finally {
        setSaving(false)
      }
    },
    [projectId]
  )

  const place = useCallback(
    (themeId: string, key: QuadrantKey | null) => {
      setPlacements((prev) => {
        const next = { ...prev, [themeId]: key }
        if (key === null) {
          // Sent back to the top to be re-placed.
          setCurrentId(themeId)
        } else if (themeId === currentIdRef.current) {
          // Placed the current card → advance to the next unplaced theme.
          const nextUnplaced = themes.find((t) => !next[t.id])
          setCurrentId(nextUnplaced ? nextUnplaced.id : null)
        }
        return next
      })
      void persist(themeId, key)
    },
    [persist, themes]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return
      const themeId = String(active.id)
      const target = String(over.id)
      if ((QUADRANT_KEYS as readonly string[]).includes(target)) {
        place(themeId, target as QuadrantKey)
      }
    },
    [place]
  )

  const placedCount = themes.filter((t) => placements[t.id]).length
  const allPlaced = placedCount === themes.length
  const current = currentId ? themeById.get(currentId) : null

  async function finish() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/quadrant/projects/${projectId}/done`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not finish')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish')
      setSubmitting(false)
      setConfirming(false)
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Progress */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-ink-soft">
          {current
            ? 'Drag the card into the spot that fits: how expected vs. distinctive is it, and how much does it matter? Click a placed card to move it back up.'
            : 'Every theme is placed. Review the board, then finish.'}
        </p>
        <div className="flex items-center gap-3">
          {saving ? (
            <span className="text-xs text-ink-muted">Saving…</span>
          ) : (
            <span className="text-xs text-pass">✓ Saved</span>
          )}
          <span className="text-xs font-semibold text-ink">
            {placedCount} / {themes.length} placed
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-fail-soft border border-fail-line rounded-md text-fail text-sm">{error}</div>
      )}

      {/* Board */}
      <div className="rounded-xl border border-line p-4 sm:p-6" style={{ ...DOTTED, backgroundColor: 'var(--color-canvas)' }}>
        {/* The theme to place, one at a time */}
        <div className="mb-6 min-h-[4rem]">
          {current ? (
            <CurrentCard theme={current} />
          ) : (
            <div className="mx-auto w-full max-w-md text-center py-4">
              <p className="text-2xl mb-1">✓</p>
              <p className="text-sm font-semibold text-ink">All {themes.length} themes placed</p>
              <p className="text-xs text-ink-muted mt-0.5">Click any card below to adjust it.</p>
            </div>
          )}
        </div>

        {/* The 2×2 */}
        <QuadrantFrame
          axisLabels={axisLabels}
          renderQuadrant={(key: QuadrantKey) => {
            const inHere = themes.filter((t) => placements[t.id] === key)
            return (
              <QuadrantCell quadrantKey={key} count={inHere.length}>
                {inHere.map((t) => (
                  <PlacedChip key={t.id} theme={t} onBringBack={() => place(t.id, null)} />
                ))}
              </QuadrantCell>
            )
          }}
        />
      </div>

      {/* Finish */}
      <div className="mt-6 border-t border-line pt-5">
        {confirming ? (
          <div className="rounded-lg border border-accent/50 bg-accent/10 p-4">
            <p className="text-sm text-ink font-medium">
              This locks in your placements. You won&apos;t be able to change them unless the facilitator reopens the
              workshop.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={finish}
                disabled={submitting}
                className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {submitting ? 'Finishing…' : 'Yes, finish'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="px-4 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink"
              >
                Keep editing
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setConfirming(true)}
              disabled={!allPlaced}
              className="px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Review &amp; finish →
            </button>
            {!allPlaced && (
              <span className="text-sm text-ink-soft">
                {themes.length - placedCount} {themes.length - placedCount === 1 ? 'theme' : 'themes'} left to place.
              </span>
            )}
          </div>
        )}
      </div>
    </DndContext>
  )
}
