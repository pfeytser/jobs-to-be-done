'use client'

import { useState, useCallback, useEffect } from 'react'

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

// A card's image state from the UI's perspective
type ImageState = 'ready' | 'generating' | 'failed' | 'never_requested'

function getImageState(card: Card): ImageState {
  if (card.image_url) return 'ready' // may still be expired — detected via onError
  if (!card.generation_requested_at) return 'never_requested'
  const age = Date.now() - new Date(card.generation_requested_at).getTime()
  return age < 90_000 ? 'generating' : 'failed'
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

  const handleRetry = useCallback(
    async (cardId: string) => {
      // Optimistically mark as generating
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, image_url: null, generation_requested_at: new Date().toISOString() }
            : c
        )
      )

      try {
        await fetch(
          `/api/storyboard/use-cases/${useCase.id}/cards/${cardId}/generate-image`,
          { method: 'POST' }
        )
      } catch {
        // Leave in 'generating' state — will flip to 'failed' after 90s
      }

      // Poll for result after 35s
      setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/storyboard/use-cases/${useCase.id}/cards?reveal=true`
          )
          if (!res.ok) return
          const data = await res.json()
          const updated = data.cards?.find((c: Card) => c.id === cardId)
          if (updated?.image_url) {
            setCards((prev) =>
              prev.map((c) => (c.id === cardId ? { ...c, image_url: updated.image_url } : c))
            )
          }
        } catch {
          // Silent
        }
      }, 35_000)
    },
    [useCase.id]
  )

  const handleImageError = useCallback((cardId: string) => {
    // URL was set but failed to load (expired DALL-E URL) — treat as failed
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, image_url: null } : c
      )
    )
  }, [])

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
        {cards.map((c, i) => {
          const state = getImageState(c)
          const hasIssue = state !== 'ready'
          return (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              title={hasIssue ? 'Image unavailable' : `Scene ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex
                  ? 'bg-ink'
                  : hasIssue
                  ? 'bg-red-300 hover:bg-red-400'
                  : 'bg-warm-border hover:bg-ink-3'
              }`}
            />
          )
        })}
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pb-6 max-w-4xl mx-auto w-full">
        {/* Image area */}
        <div className="w-full aspect-video bg-canvas border border-warm-border rounded-[16px] overflow-hidden mb-6 relative">
          <ImageSlot
            card={card}
            index={currentIndex}
            isAdmin={isAdmin}
            onRetry={() => handleRetry(card.id)}
            onImageError={() => handleImageError(card.id)}
          />
        </div>

        {/* Scene text */}
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest">
              Scene {currentIndex + 1} of {cards.length}
            </p>
            {isAdmin && (
              <AdminRegenerateButton
                cardId={card.id}
                onRetry={() => handleRetry(card.id)}
              />
            )}
          </div>
          <p className="text-base text-ink leading-relaxed">
            {card.scene_description || (
              <span className="text-ink-3 italic">No description</span>
            )}
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
  onImageError,
}: {
  card: Card
  index: number
  isAdmin: boolean
  onRetry: () => void
  onImageError: () => void
}) {
  const [retrying, setRetrying] = useState(false)
  const state = getImageState(card)

  // Reset retrying spinner after 40s if no image appeared
  useEffect(() => {
    if (state !== 'generating') setRetrying(false)
  }, [state])

  async function handleRetry() {
    setRetrying(true)
    await onRetry()
  }

  // State: image ready — but detect if the URL is broken (expired)
  if (state === 'ready') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.image_url!}
        alt={`Scene ${index + 1}`}
        className="w-full h-full object-cover"
        onError={onImageError}
      />
    )
  }

  // State: generating (request fired < 90s ago)
  if (state === 'generating' || retrying) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <svg className="w-6 h-6 text-ink-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm text-ink-3">Generating image…</p>
        <p className="text-xs text-ink-3 opacity-60">This takes about 20–30 seconds</p>
      </div>
    )
  }

  // State: failed (generation was attempted but no image)
  if (state === 'failed') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <svg className="w-6 h-6 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm text-ink-3">Image generation failed</p>
        {isAdmin && (
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

  // State: never_requested (timer never fired — no text when debounce elapsed, or user left too fast)
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
      <svg className="w-6 h-6 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-sm text-ink-3">Image not yet generated</p>
      {isAdmin && (
        <button
          onClick={handleRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-warm-border rounded-lg text-ink-3 hover:text-ink hover:border-ink transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate image
        </button>
      )}
    </div>
  )
}

function AdminRegenerateButton({
  cardId,
  onRetry,
}: {
  cardId: string
  onRetry: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    await onRetry()
    setBusy(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium border border-warm-border rounded-lg text-ink-3 hover:text-ink hover:border-ink transition-colors disabled:opacity-40"
    >
      <svg
        className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {busy ? 'Requesting…' : 'Regenerate image'}
    </button>
  )
}
