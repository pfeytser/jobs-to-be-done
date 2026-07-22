'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json())

interface StatusData {
  status: string
  phase: 'categories' | 'combined' | null
  submittedCount: number
  participantCount: number
  submittedNames?: string[]
  pendingNames?: string[]
}

type Action = 'advance' | 'reveal' | 'reopen' | 'archive' | 'unarchive'

/** Facilitator control bar. Lives above every non-draft view for admins. */
export function AdminControls({
  workshopId,
  status,
  mode = 'single',
}: {
  workshopId: string
  status: string
  mode?: 'single' | 'multi'
}) {
  const router = useRouter()
  const { data } = useSWR<StatusData>(`/api/workshop/sessions/${workshopId}`, fetcher, {
    refreshInterval: 4000,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Action | null>(null)

  async function run(action: Action) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/workshop/sessions/${workshopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Action failed')
      }
      setConfirm(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const submitted = data?.submittedCount ?? 0
  const total = data?.participantCount ?? 0
  const pending = data?.pendingNames ?? []

  const primary: { action: Action; label: string } | null =
    status === 'ranking_categories'
      ? mode === 'multi'
        ? { action: 'reveal', label: 'Reveal group priorities →' }
        : { action: 'advance', label: 'Advance to combined round →' }
      : status === 'ranking_combined'
        ? { action: 'reveal', label: 'Reveal group priorities →' }
        : null

  return (
    <div className="mb-6 rounded-lg border border-accent/40 bg-accent/10 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚙️</span>
          <span className="text-xs font-bold uppercase tracking-widest text-ink-soft">Facilitator</span>
          {data?.phase && (
            <span className="text-sm text-ink-soft">
              · <strong className="text-ink">{submitted} of {total}</strong> submitted
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {status === 'ranking_categories' && (
            <Link
              href={`/workshop/${workshopId}/edit`}
              className="px-3 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors"
            >
              ✎ Edit items
            </Link>
          )}
          {primary && (
            <button
              onClick={() => run(primary.action)}
              disabled={busy}
              className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Working…' : primary.label}
            </button>
          )}

          {status === 'ranking_combined' && (
            <button
              onClick={() => run('reopen')}
              disabled={busy}
              className="px-3 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors disabled:opacity-40"
            >
              ← Back to categories
            </button>
          )}

          {status === 'revealed' && (
            <>
              <button
                onClick={() => run('reopen')}
                disabled={busy}
                className="px-3 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors disabled:opacity-40"
              >
                {mode === 'multi' ? '← Reopen ranking round' : '← Reopen combined round'}
              </button>
              <button
                onClick={() => run('archive')}
                disabled={busy}
                className="px-3 py-2 bg-canvas border border-line text-ink-muted text-sm font-medium rounded-md hover:border-ink transition-colors disabled:opacity-40"
              >
                Archive
              </button>
            </>
          )}

          {status === 'archived' && (
            <button
              onClick={() => run('unarchive')}
              disabled={busy}
              className="px-3 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors disabled:opacity-40"
            >
              Unarchive
            </button>
          )}
        </div>
      </div>

      {data?.phase && pending.length > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Still ranking: {pending.join(', ')}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-fail">{error}</p>}
    </div>
  )
}
