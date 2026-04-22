'use client'

import { useState, useCallback } from 'react'

interface Card {
  id: string
  scene_description: string
  sort_order: number
  image_url: string | null
  generation_requested_at: string | null
}

interface UseCase {
  id: string
  name: string
}

export default function PresentationMode({
  useCase,
  initialCards,
  isAdmin,
}: {
  useCase: UseCase
  initialCards: Card[]
  isAdmin: boolean
}) {
  const [cards, setCards] = useState(() =>
    [...initialCards].sort((a, b) => a.sort_order - b.sort_order)
  )
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleRetry = useCallback(async (cardId: string) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, generation_requested_at: new Date().toISOString() }
          : c
      )
    )
    try {
      await fetch(
        `/api/storyboard/use-cases/${useCase.id}/cards/${cardId}/generate-image`,
        { method: 'POST' }
      )
      // Poll once after 30s to pick up the result
      setTimeout(async () => {
        const res = await fetch(`/api/storyboard/use-cases/${useCase.id}/cards?reveal=true`)
        if (!res.ok) return
        const data = await res.json()
        const updated = data.cards?.find((c: Card) => c.id === cardId)
        if (updated?.image_url) {
          setCards((prev) =>
            prev.map((c) => (c.id === cardId ? { ...c, image_url: updated.image_url } : c))
          )
        }
      }, 35000)
    } catch {
      // Silent — user sees the "retry" state remain
    }
  }, [useCase.id])

  if (cards.length === 0) {
    return (
      <main className="flex items-center justify-center min-h-[60vh] px-6">
        <p className="text-ink-3 text-sm">No scenes have been added to this storyboard yet.</p>
      </main>
    )
  }

  const card = cards[currentIndex]
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < cards.length - 1

  return (
    <main className="min-h-[calc(100vh-57px)] flex flex-col">
      {/* Dot nav */}
      <div className="flex items-center justify-center gap-2 pt-6 pb-4">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentIndex ? 'bg-ink' : 'bg-warm-border hover:bg-ink-3'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pb-6 max-w-4xl mx-auto w-full">
        {/* Image area */}
        <div className="w-full aspect-video bg-canvas border border-warm-border rounded-[16px] overflow-hidden mb-6 relative">
          <ImageSlot
            card={card}
            index={currentIndex}
            isAdmin={isAdmin}
            onRetry={() => handleRetry(card.id)}
          />
        </div>

        {/* Scene text */}
        <div className="w-full max-w-2xl">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-2">
            Scene {currentIndex + 1} of {cards.length}
          </p>
          <p className="text-base text-ink leading-relaxed">
            {card.scene_description || <span className="text-ink-3 italic">No description</span>}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-6 mt-8">
          <button
            onClick={() => setCurrentIndex((i) => i - 1)}
            disabled={!hasPrev}
            className="flex items-center gap-2 px-5 py-2.5 border border-warm-border rounded-lg text-sm font-medium text-ink hover:border-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          <span className="text-sm text-ink-3 tabular-nums">
            {currentIndex + 1} / {cards.length}
          </span>

          <button
            onClick={() => setCurrentIndex((i) => i + 1)}
            disabled={!hasNext}
            className="flex items-center gap-2 px-5 py-2.5 border border-warm-border rounded-lg text-sm font-medium text-ink hover:border-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  )
}

function ImageSlot({
  card,
  index,
  isAdmin,
  onRetry,
}: {
  card: Card
  index: number
  isAdmin: boolean
  onRetry: () => void
}) {
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    setRetrying(true)
    await onRetry()
    // Keep spinner for 35s while we wait for generation
    setTimeout(() => setRetrying(false), 35000)
  }

  // State 1: image ready
  if (card.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.image_url}
        alt={`Scene ${index + 1}`}
        className="w-full h-full object-cover"
      />
    )
  }

  // State 2: generation was requested but no image yet (generating or failed)
  if (card.generation_requested_at) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-2 text-ink-3">
          {retrying ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
          <span className="text-sm">
            {retrying ? 'Generating image…' : 'Image generation failed'}
          </span>
        </div>
        {isAdmin && !retrying && (
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-warm-border rounded-lg text-ink-3 hover:text-ink hover:border-ink transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry generation
          </button>
        )}
      </div>
    )
  }

  // State 3: never requested (scene has no text, or debounce never fired)
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl mb-2">🎬</p>
        <p className="text-xs text-ink-3">Scene {index + 1}</p>
      </div>
    </div>
  )
}
