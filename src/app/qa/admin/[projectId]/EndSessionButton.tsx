'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function EndSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleEnd() {
    setLoading(true)
    try {
      await fetch(`/api/qa/sessions/${sessionId}`, { method: 'PATCH' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleEnd}
      disabled={loading}
      className="px-2.5 py-1 text-xs font-medium rounded-full border border-warm-border bg-canvas text-ink-2 hover:text-ink hover:border-ink transition-all disabled:opacity-50 whitespace-nowrap"
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          End session
        </span>
      ) : 'End session'}
    </button>
  )
}
