'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui'

export type TtStatus = 'draft' | 'active' | 'completed' | 'archived'

type Action = 'activate' | 'reveal' | 'reopen' | 'archive' | 'unarchive'

/**
 * Self-contained lifecycle controls for a single session. Shown to anyone who
 * can manage it (the admin, or the session's creator). Manages its own busy
 * and error state and refreshes the route on success.
 */
export function ManageControls({ sessionId, status }: { sessionId: string; status: TtStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function run(fn: () => Promise<Response>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Action failed.')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  const act = (action: Action) =>
    run(() =>
      fetch(`/api/two-truths/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
    )

  const remove = async () => {
    await run(() => fetch(`/api/two-truths/sessions/${sessionId}`, { method: 'DELETE' }))
    setConfirmOpen(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {status === 'draft' && (
          <>
            <button
              onClick={() => act('activate')}
              disabled={busy}
              className="px-3 py-1.5 bg-ink text-white text-xs font-bold rounded-full hover:opacity-90 disabled:opacity-50"
            >
              Activate
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
              className="px-3 py-1.5 text-fail text-xs font-bold rounded-full hover:bg-fail-soft disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
        {status === 'active' && (
          <button
            onClick={() => act('reveal')}
            disabled={busy}
            className="px-3 py-1.5 bg-accent text-ink text-xs font-bold rounded-full hover:opacity-90 disabled:opacity-50"
          >
            Reveal answer
          </button>
        )}
        {status === 'completed' && (
          <>
            <button
              onClick={() => act('reopen')}
              disabled={busy}
              className="px-3 py-1.5 bg-accent text-ink text-xs font-bold rounded-full hover:opacity-90 disabled:opacity-50"
            >
              Reopen voting
            </button>
            <button
              onClick={() => act('archive')}
              disabled={busy}
              className="px-3 py-1.5 border border-line text-ink-soft text-xs font-bold rounded-full hover:border-ink disabled:opacity-50"
            >
              Archive
            </button>
          </>
        )}
        {status === 'archived' && (
          <button
            onClick={() => act('unarchive')}
            disabled={busy}
            className="px-3 py-1.5 border border-line text-ink-soft text-xs font-bold rounded-full hover:border-ink disabled:opacity-50"
          >
            Unarchive
          </button>
        )}
      </div>
      {error && <span className="text-xs text-fail text-right">{error}</span>}
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
        title="Delete this draft game?"
        danger
        confirmLabel="Delete"
        loading={busy}
      >
        This can’t be undone.
      </ConfirmDialog>
    </div>
  )
}
