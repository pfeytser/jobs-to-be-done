'use client'

import { useState } from 'react'

interface Card {
  id: string
  scene_description: string
  sort_order: number
  image_url: string | null
}

interface UseCase {
  id: string
  name: string
}

export default function PresentationMode({
  useCase,
  initialCards,
}: {
  useCase: UseCase
  initialCards: Card[]
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const cards = [...initialCards].sort((a, b) => a.sort_order - b.sort_order)

  if (cards.length === 0) {
    return (
      <main className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="text-center">
          <p className="text-ink-3 text-sm">No scenes have been added to this storyboard yet.</p>
        </div>
      </main>
    )
  }

  const card = cards[currentIndex]
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < cards.length - 1

  return (
    <main className="min-h-[calc(100vh-57px)] flex flex-col">
      {/* Scene counter */}
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

      {/* Image */}
      <div className="flex-1 flex flex-col items-center px-6 pb-6 max-w-4xl mx-auto w-full">
        <div className="w-full aspect-video bg-canvas border border-warm-border rounded-[16px] overflow-hidden mb-6 relative">
          {card.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image_url}
              alt={`Scene ${currentIndex + 1}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-3xl mb-2">🎬</p>
                <p className="text-xs text-ink-3">Scene {currentIndex + 1}</p>
              </div>
            </div>
          )}
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
