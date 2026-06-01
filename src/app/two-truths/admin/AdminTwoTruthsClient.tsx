'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Status = 'draft' | 'active' | 'completed' | 'archived'

interface AdminSession {
  id: string
  title: string
  author_name: string
  status: Status
  created_at: string
  votes: number
  statements: { text: string }[]
}

interface UserOption {
  user_id: string
  name: string
  email: string
}

const STATUS_STYLES: Record<Status, string> = {
  draft: 'bg-status-skipped text-status-skipped-text',
  active: 'bg-status-pass text-status-pass-text',
  completed: 'bg-mist text-ink-2',
  archived: 'bg-canvas text-ink-3 border border-warm-border',
}

const STATUS_LABELS: Record<Status, string> = {
  draft: 'Draft',
  active: 'Live',
  completed: 'Revealed',
  archived: 'Archived',
}

export function AdminTwoTruthsClient({
  initialSessions,
  users,
}: {
  initialSessions: AdminSession[]
  users: UserOption[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // create form
  const [title, setTitle] = useState('')
  const [authorId, setAuthorId] = useState('')
  const [creating, setCreating] = useState(false)

  const sessions = initialSessions
  const liveSessions = sessions.filter((s) => s.status !== 'archived')
  const archivedSessions = sessions.filter((s) => s.status === 'archived')

  async function createSession(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !authorId) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/two-truths/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), authorId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not create session.')
      }
      setTitle('')
      setAuthorId('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create session.')
    } finally {
      setCreating(false)
    }
  }

  async function act(
    id: string,
    action: 'activate' | 'reveal' | 'reopen' | 'archive' | 'unarchive'
  ) {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/two-truths/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Action failed.')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this draft session? This cannot be undone.')) return
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/two-truths/sessions/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not delete.')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.')
    } finally {
      setBusy(null)
    }
  }

  function Row({ s }: { s: AdminSession }) {
    const isBusy = busy === s.id
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-surface border border-warm-border rounded-xl">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLES[s.status]}`}>
              {STATUS_LABELS[s.status]}
            </span>
            <Link href={`/two-truths/${s.id}`} className="font-bold text-ink truncate hover:underline">
              {s.title}
            </Link>
          </div>
          <p className="text-xs text-ink-3 mt-1">
            by {s.author_name} · {new Date(s.created_at).toLocaleDateString()} ·{' '}
            {s.votes} {s.votes === 1 ? 'vote' : 'votes'}
          </p>
          {s.statements.length > 0 && (
            <ul className="mt-2 space-y-1">
              {s.statements.map((st, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 text-ink-3 font-mono">{i + 1}.</span>
                  <span className={st.text.trim() ? 'text-ink-2' : 'text-ink-3 italic'}>
                    {st.text.trim() || 'not filled in yet'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {s.status === 'draft' && (
            <>
              <button
                onClick={() => act(s.id, 'activate')}
                disabled={isBusy}
                className="px-3 py-1.5 bg-ink text-white text-xs font-bold rounded-full hover:opacity-90 disabled:opacity-50"
              >
                Activate
              </button>
              <button
                onClick={() => remove(s.id)}
                disabled={isBusy}
                className="px-3 py-1.5 text-status-fail-text text-xs font-bold rounded-full hover:bg-status-fail disabled:opacity-50"
              >
                Delete
              </button>
            </>
          )}
          {s.status === 'active' && (
            <button
              onClick={() => act(s.id, 'reveal')}
              disabled={isBusy}
              className="px-3 py-1.5 bg-gold text-ink text-xs font-bold rounded-full hover:opacity-90 disabled:opacity-50"
            >
              Reveal answer
            </button>
          )}
          {s.status === 'completed' && (
            <>
              <button
                onClick={() => act(s.id, 'reopen')}
                disabled={isBusy}
                className="px-3 py-1.5 bg-gold text-ink text-xs font-bold rounded-full hover:opacity-90 disabled:opacity-50"
              >
                Reopen voting
              </button>
              <button
                onClick={() => act(s.id, 'archive')}
                disabled={isBusy}
                className="px-3 py-1.5 border border-warm-border text-ink-2 text-xs font-bold rounded-full hover:border-ink disabled:opacity-50"
              >
                Archive
              </button>
            </>
          )}
          {s.status === 'archived' && (
            <button
              onClick={() => act(s.id, 'unarchive')}
              disabled={isBusy}
              className="px-3 py-1.5 border border-warm-border text-ink-2 text-xs font-bold rounded-full hover:border-ink disabled:opacity-50"
            >
              Unarchive
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-3xl mx-auto px-5 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-3 mb-1">⚙️ Host controls</p>
            <h1 className="text-3xl font-black text-ink tracking-tight">Two Truths &amp; A Lie</h1>
          </div>
          <Link href="/two-truths" className="text-sm font-semibold text-ink-2 hover:text-ink">
            View games →
          </Link>
        </div>

        {/* Create */}
        <form onSubmit={createSession} className="p-5 bg-surface border border-warm-border rounded-2xl mb-8">
          <p className="text-sm font-bold text-ink mb-3">Start a new game</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Game title (e.g. Friday Standup Round)"
              maxLength={200}
              className="sm:flex-1 min-w-0 px-4 py-2.5 bg-canvas border border-warm-border rounded-xl text-ink placeholder:text-ink-3 focus:outline-none focus:border-ink"
            />
            <select
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              className="sm:flex-1 min-w-0 px-4 py-2.5 bg-canvas border border-warm-border rounded-xl text-ink focus:outline-none focus:border-ink truncate"
            >
              <option value="">Assign author…</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creating || !title.trim() || !authorId}
              className="shrink-0 px-5 py-2.5 bg-ink text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
          {users.length === 0 && (
            <p className="text-xs text-ink-3 mt-2">
              No registered users yet — players appear here after they sign in once.
            </p>
          )}
        </form>

        {error && (
          <p className="mb-4 text-sm text-status-fail-text font-medium bg-status-fail border border-status-fail-border rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}

        {/* Live / draft / completed list */}
        <div className="space-y-2.5">
          {liveSessions.length === 0 ? (
            <p className="text-ink-3 text-sm py-8 text-center bg-surface rounded-2xl border border-warm-border">
              No games yet. Create one above to get started.
            </p>
          ) : (
            liveSessions.map((s) => <Row key={s.id} s={s} />)
          )}
        </div>

        {/* Archived */}
        {archivedSessions.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="text-sm font-bold text-ink-2 hover:text-ink flex items-center gap-1.5"
            >
              <span className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>▸</span>
              Archived ({archivedSessions.length})
            </button>
            {showArchived && (
              <div className="space-y-2.5 mt-3">
                {archivedSessions.map((s) => (
                  <Row key={s.id} s={s} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
