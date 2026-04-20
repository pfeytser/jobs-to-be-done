'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CompleteSessionButtonProps {
  sessionId: string
  redirectTo?: string
  className?: string
  label?: string
}

export function CompleteSessionButton({
  sessionId,
  redirectTo,
  className,
  label = 'Testing Complete',
}: CompleteSessionButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleComplete() {
    setLoading(true)
    try {
      await fetch(`/api/qa/sessions/${sessionId}`, { method: 'PATCH' })
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className={className ?? 'px-3 py-1.5 text-xs font-semibold rounded-full border border-warm-border bg-canvas text-ink hover:bg-status-pass hover:border-status-pass-border hover:text-status-pass-text transition-all disabled:opacity-50'}
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {label}
        </span>
      ) : label}
    </button>
  )
}
