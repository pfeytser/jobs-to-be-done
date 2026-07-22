'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Polls the poll-safe status endpoint and refreshes the server-rendered view the
 * moment the workshop's status changes (admin activates / advances / reveals).
 * Never receives other participants' orderings — only status and tallies.
 */
export function StatusPoller({
  workshopId,
  currentStatus,
  currentUpdatedAt,
  intervalMs = 4000,
}: {
  workshopId: string
  currentStatus: string
  /** When this changes (a facilitator edited items or advanced), re-render. */
  currentUpdatedAt?: string
  intervalMs?: number
}) {
  const router = useRouter()
  const statusRef = useRef(currentStatus)
  statusRef.current = currentStatus
  const updatedRef = useRef(currentUpdatedAt)
  updatedRef.current = currentUpdatedAt

  useEffect(() => {
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/workshop/sessions/${workshopId}`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const statusChanged = data.status && data.status !== statusRef.current
        const contentChanged = data.updatedAt && updatedRef.current && data.updatedAt !== updatedRef.current
        if (statusChanged || contentChanged) router.refresh()
      } catch {
        // Transient network error — keep polling.
      }
    }, intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [workshopId, intervalMs, router])

  return null
}
