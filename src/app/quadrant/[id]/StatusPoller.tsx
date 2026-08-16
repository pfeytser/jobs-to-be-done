'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Polls the poll-safe status endpoint and refreshes the server-rendered view the
 * moment the project's status changes (admin starts / reveals / reopens) or its
 * content is edited. Never receives other participants' placements.
 */
export function StatusPoller({
  projectId,
  currentStatus,
  currentUpdatedAt,
  intervalMs = 4000,
}: {
  projectId: string
  currentStatus: string
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
        const res = await fetch(`/api/quadrant/projects/${projectId}`, { cache: 'no-store' })
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
  }, [projectId, intervalMs, router])

  return null
}
