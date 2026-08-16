'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ShareLink } from './ShareLink'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json())

interface StatusData {
  status: string
  doneCount: number
  participantCount: number
  doneNames?: string[]
  pendingNames?: string[]
}

type Action = 'reveal' | 'reopen'

/** Facilitator control bar shown above the active monitor and the reveal. */
export function AdminMonitor({
  projectId,
  status,
  frozen = false,
}: {
  projectId: string
  status: 'active' | 'reveal'
  /** When the vote is frozen, reopening is refused — don't offer it. */
  frozen?: boolean
}) {
  const router = useRouter()
  const { data } = useSWR<StatusData>(`/api/quadrant/projects/${projectId}`, fetcher, { refreshInterval: 3000 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: Action) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quadrant/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Action failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const done = data?.doneCount ?? 0
  const total = data?.participantCount ?? 0
  const pending = data?.pendingNames ?? []
  const everyoneDone = total > 0 && done === total

  return (
    <div className="mb-6 rounded-lg border border-accent/40 bg-accent/10 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚙️</span>
          <span className="text-xs font-bold uppercase tracking-widest text-ink-soft">Facilitator</span>
          <span className="text-sm text-ink-soft">
            · <strong className="text-ink">{done} of {total}</strong> finished
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {status === 'active' && (
            <button
              onClick={() => run('reveal')}
              disabled={busy}
              className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Working…' : everyoneDone ? 'Reveal group results →' : 'Reveal now (some still placing) →'}
            </button>
          )}
          {status === 'reveal' && (
            <>
              <a
                href={`/api/quadrant/projects/${projectId}/export`}
                className="px-3 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors"
              >
                ↓ Export CSV
              </a>
              {!frozen && (
                <button
                  onClick={() => run('reopen')}
                  disabled={busy}
                  className="px-3 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors disabled:opacity-40"
                >
                  ← Reopen for edits
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {status === 'active' && (
        <div className="mt-3 pt-3 border-t border-accent/30">
          <ShareLink path={`/quadrant/${projectId}`} />
          {total === 0 ? (
            <p className="mt-2 text-xs text-ink-muted">No one has joined yet. Share the link above.</p>
          ) : pending.length > 0 ? (
            <p className="mt-2 text-xs text-ink-muted">Still placing: {pending.join(', ')}</p>
          ) : (
            <p className="mt-2 text-xs text-pass">Everyone who joined has finished.</p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-fail">{error}</p>}
    </div>
  )
}
