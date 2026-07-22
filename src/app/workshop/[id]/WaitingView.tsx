'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json())

/**
 * Shown after a participant submits: a live tally of how many colleagues have
 * finished this round. Refreshes on its own; the StatusPoller moves everyone on
 * when the admin advances. Participants can un-submit to edit while the round
 * is still live.
 */
export function WaitingView({
  workshopId,
  roundLabel,
}: {
  workshopId: string
  roundLabel: string
}) {
  const router = useRouter()
  const { data } = useSWR<{ submittedCount: number; participantCount: number }>(
    `/api/workshop/sessions/${workshopId}`,
    fetcher,
    { refreshInterval: 4000 }
  )
  const submitted = data?.submittedCount ?? 0
  const total = data?.participantCount ?? 0

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function unsubmit() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/workshop/sessions/${workshopId}/rankings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unsubmit' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Could not reopen your ranking')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reopen your ranking')
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto text-center py-16">
      <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-pass-soft border border-pass/40 flex items-center justify-center text-2xl">
        ✓
      </div>
      <h2 className="text-xl font-bold text-ink mb-2">You&apos;re all set</h2>
      <p className="text-sm text-ink-soft mb-6">
        Your {roundLabel} ranking is in. Hang tight while your colleagues finish theirs — the
        facilitator will move the group forward.
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-line">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
        </span>
        <span className="text-sm font-semibold text-ink">
          {submitted} of {total} submitted
        </span>
      </div>

      <div className="mt-6">
        <button
          onClick={unsubmit}
          disabled={busy}
          className="text-sm font-medium text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-40 transition-colors"
        >
          {busy ? 'Reopening…' : 'Change my ranking'}
        </button>
        {error && <p className="mt-2 text-xs text-fail">{error}</p>}
      </div>
    </div>
  )
}
