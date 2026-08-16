'use client'

import useSWR from 'swr'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json())

/** Shown after a participant clicks Done. Group results stay hidden until the
 *  facilitator advances to reveal (the StatusPoller then refreshes the page). */
export function WaitingView({ projectId }: { projectId: string }) {
  const { data } = useSWR<{ doneCount: number; participantCount: number }>(
    `/api/quadrant/projects/${projectId}`,
    fetcher,
    { refreshInterval: 4000 }
  )
  const done = data?.doneCount ?? 0
  const total = data?.participantCount ?? 0

  return (
    <div className="mt-6 p-8 bg-surface border border-line rounded-lg text-center">
      <div className="text-4xl mb-3">✓</div>
      <h2 className="font-display text-2xl font-light text-ink tracking-tight">You&apos;re all set</h2>
      <p className="text-ink-soft mt-1">Your placements are locked in. Hang tight while others finish.</p>
      <p className="mt-4 inline-block px-3 py-1 rounded-full bg-canvas border border-line text-sm text-ink-soft">
        <strong className="text-ink">{done} of {total}</strong> finished
      </p>
      <p className="text-xs text-ink-muted mt-4">
        The facilitator will reveal the group results — this page updates on its own.
      </p>
    </div>
  )
}
