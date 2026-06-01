'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface UserOption {
  user_id: string
  name: string
  email: string
}

/** Create-a-game form, used on both the dashboard and the admin page.
 * Any signed-in user can create a session and assign an author. */
export function CreateGameForm({ users }: { users: UserOption[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [authorId, setAuthorId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
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
        throw new Error(data.error || 'Could not create game.')
      }
      setTitle('')
      setAuthorId('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create game.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={submit} className="p-5 bg-surface border border-warm-border rounded-2xl">
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
      {error && <p className="text-sm text-status-fail-text font-medium mt-2">{error}</p>}
      {users.length === 0 && (
        <p className="text-xs text-ink-3 mt-2">
          No registered users yet — people appear here after they sign in once.
        </p>
      )}
    </form>
  )
}
