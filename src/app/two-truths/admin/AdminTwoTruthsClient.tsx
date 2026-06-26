'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CreateGameForm, type UserOption } from '../CreateGameForm'
import { SessionRow, type ManagedSession } from '../SessionRow'

export function AdminTwoTruthsClient({
  initialSessions,
  users,
}: {
  initialSessions: ManagedSession[]
  users: UserOption[]
}) {
  const [showArchived, setShowArchived] = useState(false)

  const liveSessions = initialSessions.filter((s) => s.status !== 'archived')
  const archivedSessions = initialSessions.filter((s) => s.status === 'archived')

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-1">⚙️ Host controls</p>
            <h1 className="text-3xl font-black text-ink tracking-tight">Two Truths &amp; A Lie</h1>
            <p className="text-sm text-ink-muted mt-1">Every game across the team — full controls.</p>
          </div>
          <Link href="/two-truths" className="text-sm font-semibold text-ink-soft hover:text-ink">
            View games →
          </Link>
        </div>

        <div className="mb-8">
          <CreateGameForm users={users} />
        </div>

        <div className="space-y-2.5">
          {liveSessions.length === 0 ? (
            <p className="text-ink-muted text-sm py-8 text-center bg-surface rounded-lg border border-line">
              No games yet. Create one above to get started.
            </p>
          ) : (
            liveSessions.map((s) => <SessionRow key={s.id} s={s} />)
          )}
        </div>

        {archivedSessions.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="text-sm font-bold text-ink-soft hover:text-ink flex items-center gap-1.5"
            >
              <span className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>▸</span>
              Archived ({archivedSessions.length})
            </button>
            {showArchived && (
              <div className="space-y-2.5 mt-3">
                {archivedSessions.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
