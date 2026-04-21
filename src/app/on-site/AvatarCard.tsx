'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AvatarCard({
  seaCreature,
  avatarUrl,
}: {
  seaCreature: string
  avatarUrl: string | null
}) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)

  async function handleRegenerate() {
    setGenerating(true)
    try {
      await fetch('/api/profile/generate-avatar', { method: 'POST' })
      router.refresh()
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex items-center gap-4 p-5 bg-surface border border-warm-border rounded-[16px]">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={seaCreature}
          className="w-16 h-16 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-canvas border border-warm-border flex items-center justify-center text-2xl shrink-0">
          🌊
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-3 uppercase tracking-widest font-medium mb-0.5">Your sea creature</p>
        <p className="text-base font-semibold text-ink capitalize">{seaCreature}</p>
      </div>
      <button
        onClick={handleRegenerate}
        disabled={generating}
        title={avatarUrl ? 'Regenerate avatar' : 'Generate avatar'}
        className="shrink-0 p-2 text-ink-3 hover:text-ink transition-colors disabled:opacity-40"
      >
        {generating ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
      </button>
    </div>
  )
}
