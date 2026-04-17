import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getQAProjectBySlug } from '@/lib/db/qa-projects'
import { getTesterSessionsWithProgress, getUserTypeTesterCounts } from '@/lib/db/qa-sessions'
import { NewSessionForm } from './NewSessionForm'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const { projectId: slug } = await params
  const project = await getQAProjectBySlug(slug)

  if (!project || project.status !== 'active') {
    redirect('/qa')
  }

  const [existingSessions, testerCounts] = await Promise.all([
    getTesterSessionsWithProgress(session.user.userId, project.id),
    getUserTypeTesterCounts(project.id, session.user.userId),
  ])

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/qa" className="text-xs text-ink-3 hover:text-ink transition-colors">
          ← All projects
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2 mb-1">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-ink-2">{project.description}</p>
        )}
      </div>

      {/* Resume existing sessions */}
      {existingSessions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-ink mb-3">Your sessions</h2>
          <div className="space-y-3">
            {existingSessions.map((s) => {
              const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
              return (
                <div key={s.id} className="bg-surface border border-warm-border rounded-[12px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-xs text-ink-2 mb-1">
                        <span className="font-medium text-ink">{s.user_type}</span>
                        <span className="text-ink-3">·</span>
                        <span>{s.viewport}</span>
                        <span className="text-ink-3">·</span>
                        <span>{s.operating_system}</span>
                        <span className="text-ink-3">·</span>
                        <span>{s.browser}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-ink-2 mt-2">
                        <span><strong className="text-ink">{s.done}</strong> / {s.total} done ({pct}%)</span>
                        <span className="text-status-pass-text">✅ {s.passed}</span>
                        <span className="text-status-fail-text">❌ {s.failed}</span>
                        <span className="text-status-blocked-text">🚧 {s.blocked}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1 bg-canvas rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ink rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-ink-3 mt-1.5">
                        Last active: {new Date(s.last_active_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href={`/qa/${slug}/session/${s.id}`}
                      className="px-4 py-2 bg-ink text-white text-xs font-semibold rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
                    >
                      Resume
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Start new session */}
      <section>
        <h2 className="text-base font-semibold text-ink mb-3">
          {existingSessions.length > 0 ? 'Start a new session' : 'Start a QA session'}
        </h2>
        <div className="bg-surface border border-warm-border rounded-[14px] p-6">
          <NewSessionForm project={project} testerCounts={testerCounts} />
        </div>
      </section>
    </main>
  )
}
