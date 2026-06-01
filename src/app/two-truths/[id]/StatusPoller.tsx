'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Polls the poll-safe status endpoint and refreshes the server-rendered view
 * the moment the session state changes (e.g. admin activates or reveals).
 * Never receives the lie or vote tallies — only status + hasVoted.
 */
export function StatusPoller({
  sessionId,
  currentStatus,
  intervalMs = 4000,
}: {
  sessionId: string
  currentStatus: string
  intervalMs?: number
}) {
  const router = useRouter()
  const statusRef = useRef(currentStatus)
  statusRef.current = currentStatus

  useEffect(() => {
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/two-truths/sessions/${sessionId}`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (data.status && data.status !== statusRef.current) {
          router.refresh()
        }
      } catch {
        // Transient network error — keep polling.
      }
    }, intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [sessionId, intervalMs, router])

  return null
}
