'use client'

import { useEffect, useState } from 'react'

interface TimerProps {
  endsAt: string | null | undefined
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function Timer({ endsAt }: TimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!endsAt) {
      setRemaining(null)
      return
    }

    const endTime = new Date(endsAt).getTime()

    function update() {
      const now = Date.now()
      const diff = endTime - now
      setRemaining(diff)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [endsAt])

  if (!endsAt || remaining === null) return null

  const isExpired = remaining <= 0
  const isUrgent = remaining > 0 && remaining <= 60_000

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold shadow-sm ${
        isExpired
          ? 'bg-gray-100 text-gray-400'
          : isUrgent
          ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {isExpired ? "Time's up!" : formatDuration(remaining)}
    </div>
  )
}
