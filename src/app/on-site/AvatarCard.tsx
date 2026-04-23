'use client'

import { useState, useEffect } from 'react'
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
  const [imgFailed, setImgFailed] = useState(false)

  // If the stored URL is broken (expired DALL-E URL), silently regenerate
  useEffect(() => {
    if (imgFailed && !generating) {
      handleRegenerate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgFailed])

  async function handleRegenerate() {
    setGenerating(true)
    setImgFailed(false)
    try {
      await fetch('/api/profile/generate-avatar', { method: 'POST' })
      router.refresh()
    } finally {
      setGenerating(false)
    }
  }

  const showImage = avatarUrl && !imgFailed && !generating

  return (
    <div className="flex items-center gap-4 p-5 bg-surface border border-warm-border rounded-[16px]">
      {/* Avatar */}
      <div className="w-16 h-16 rounded-full shrink-0 overflow-hidden bg-canvas border border-warm-border flex items-center justify-center">
        {generating ? (
          <svg className="w-5 h-5 text-ink-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={seaCreature}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-2xl">🌊</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-3 uppercase tracking-widest font-medium mb-0.5">Your sea creature</p>
        <p className="text-base font-semibold text-ink capitalize">{seaCreature}</p>
        {generating && (
          <p className="text-xs text-ink-3 mt-0.5">Generating your avatar…</p>
        )}
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
