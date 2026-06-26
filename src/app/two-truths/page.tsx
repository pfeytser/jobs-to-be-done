import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import {
  getVisibleSessions,
  getDraftSessionsForAuthor,
  getSessionsCreatedBy,
  getVotesForSession,
} from '@/lib/db/two-truths'
import { getAllUsers } from '@/lib/db/users'
import { CreateGameForm } from './CreateGameForm'
import { SessionRow } from './SessionRow'

export const dynamic = 'force-dynamic'

export default async function TwoTruthsDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const userId = session.user.userId
  const isAdmin = session.user.role === 'admin'

  const [visible, pendingDrafts, myCreated, users] = await Promise.all([
    getVisibleSessions(),
    getDraftSessionsForAuthor(userId),
    getSessionsCreatedBy(userId),
    getAllUsers(),
  ])

  const active = visible.filter((s) => s.status === 'active')
  const completed = visible.filter((s) => s.status === 'completed')

  // Which active/completed sessions has this user already voted in?
  const voteChecks = await Promise.all(
    visible.map(async (s) => {
      const votes = await getVotesForSession(s.id)
      return { id: s.id, voted: votes.some((v) => v.voter_id === userId) }
    })
  )
  const voteMap = new Map(voteChecks.map((v) => [v.id, v]))

  // Vote counts for the games this user created (for the management rows).
  const myCounts = await Promise.all(
    myCreated.map(async (s) => ({ id: s.id, count: (await getVotesForSession(s.id)).length }))
  )
  const myCountMap = new Map(myCounts.map((c) => [c.id, c.count]))

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/40 mb-3">
            <span className="text-base">🤥</span>
            <span className="text-xs font-bold tracking-wide text-ink uppercase">Team Game</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-ink tracking-tight">
            Two Truths <span className="text-ink-muted font-light">&amp;</span> A Lie
          </h1>
          <p className="text-ink-soft mt-2 text-base">
            Can you spot the fib? Vote on which statement you think is the lie.
          </p>
          {isAdmin && (
            <Link
              href="/two-truths/admin"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-ink text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
            >
              <span>⚙️</span> Admin: all games
            </Link>
          )}
        </header>

        {/* Anyone can start a game */}
        <section className="mb-8">
          <CreateGameForm users={users.map((u) => ({ user_id: u.user_id, name: u.name ?? u.email, email: u.email }))} />
        </section>

        {pendingDrafts.length > 0 && (
          <section className="mb-8">
            {pendingDrafts.map((s) => (
              <Link
                key={s.id}
                href={`/two-truths/${s.id}`}
                className="block p-5 rounded-lg bg-accent/15 border-2 border-dashed border-accent hover:bg-accent/25 transition-colors mb-3"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">
                  ✍️ Your turn to set up
                </p>
                <p className="text-lg font-bold text-ink">{s.title}</p>
                <p className="text-sm text-ink-soft mt-0.5">
                  Write your three statements, then save &amp; activate →
                </p>
              </Link>
            ))}
          </section>
        )}

        {myCreated.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">
              🎛️ Your games
            </h2>
            <div className="space-y-2.5">
              {myCreated.map((s) => (
                <SessionRow
                  key={s.id}
                  s={{
                    id: s.id,
                    title: s.title,
                    author_name: s.author_name,
                    status: s.status,
                    created_at: s.created_at,
                    votes: myCountMap.get(s.id) ?? 0,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">
            🎯 Live now
          </h2>
          {active.length === 0 ? (
            <p className="text-ink-muted text-sm py-6 text-center bg-surface rounded-lg border border-line">
              No live games right now. Check back soon!
            </p>
          ) : (
            <div className="space-y-3">
              {active.map((s) => {
                const isAuthor = s.author_id === userId
                const voted = voteMap.get(s.id)?.voted
                return (
                  <Link
                    key={s.id}
                    href={`/two-truths/${s.id}`}
                    className="flex items-center justify-between gap-4 p-5 bg-surface border border-line rounded-lg hover:border-ink hover:shadow-sm transition-all group"
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-ink truncate">{s.title}</p>
                      <p className="text-sm text-ink-soft mt-0.5">by {s.author_name}</p>
                    </div>
                    <span
                      className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                        isAuthor
                          ? 'bg-info text-ink'
                          : voted
                            ? 'bg-pass-soft text-pass'
                            : 'bg-accent text-ink group-hover:bg-ink group-hover:text-white'
                      }`}
                    >
                      {isAuthor ? 'Your game' : voted ? 'Voted ✓' : 'Play →'}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {completed.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">
              🏁 Revealed
            </h2>
            <div className="space-y-2">
              {completed.map((s) => (
                <Link
                  key={s.id}
                  href={`/two-truths/${s.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 bg-surface/60 border border-line rounded-xl hover:border-ink transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{s.title}</p>
                    <p className="text-xs text-ink-muted mt-0.5">by {s.author_name}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink-soft">See results →</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
