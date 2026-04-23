import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getQAProjectBySlug } from '@/lib/db/qa-projects'
import { getSessionsWithProgress } from '@/lib/db/qa-sessions'
import { getTestItemsByProject, getTestItemCountsByUserType } from '@/lib/db/qa-test-items'
import { getFailuresByProject } from '@/lib/db/qa-results'

export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = ['draft', 'active', 'complete', 'archived'] as const
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', active: 'Active', complete: 'Complete', archived: 'Archived',
}

export default async function ProjectDashboard({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/qa')

  const { projectId } = await params
  const project = await getQAProjectBySlug(projectId)

  if (!project) redirect('/qa/admin')

  const [sessions, items, failures, itemCountsByUserType] = await Promise.all([
    getSessionsWithProgress(project.id),
    getTestItemsByProject(project.id),
    getFailuresByProject(project.id),
    getTestItemCountsByUserType(project.id),
  ])

  // Aggregate stats
  const totalResults = sessions.reduce((acc, s) => ({
    total: acc.total + s.total,
    done: acc.done + s.done,
    passed: acc.passed + s.passed,
    failed: acc.failed + s.failed,
    blocked: acc.blocked + s.blocked,
    skipped: acc.skipped + s.skipped,
  }), { total: 0, done: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 })

  const overallPct = totalResults.total > 0
    ? Math.round((totalResults.done / totalResults.total) * 100)
    : 0

  const activeTesterIds = new Set(sessions.map((s) => s.tester_id))

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <Link href="/qa/admin" className="text-xs text-ink-3 hover:text-ink transition-colors">← Admin</Link>
        <span className="text-ink-3 text-xs">/</span>
        <span className="text-xs text-ink-2">{project.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">{project.name}</h1>
          {project.description && <p className="text-sm text-ink-2">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/qa/${projectId}`}
            className="px-3 py-2 text-sm font-medium bg-canvas border border-warm-border text-ink rounded-[8px] hover:border-ink transition-colors"
          >
            Start session
          </Link>
          <Link
            href={`/qa/admin/${projectId}/edit`}
            className="px-3 py-2 text-sm font-medium bg-canvas border border-warm-border text-ink rounded-[8px] hover:border-ink transition-colors"
          >
            Edit project
          </Link>
          <a
            href={`/api/qa/projects/${project.id}/export`}
            className="px-3 py-2 text-sm font-semibold bg-ink text-white rounded-[8px] hover:opacity-90 transition-opacity"
          >
            Export ZIP
          </a>
        </div>
      </div>

      {/* Status control */}
      <div className="mb-6 p-4 bg-surface border border-warm-border rounded-[12px] flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-ink">Project status:</span>
        <StatusChanger projectId={project.id} currentStatus={project.status} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Active testers', value: activeTesterIds.size },
          { label: 'Test items', value: items.length },
          { label: 'Overall progress', value: `${overallPct}%` },
          { label: 'Failures logged', value: failures.length },
        ].map((card) => (
          <div key={card.label} className="bg-surface border border-warm-border rounded-[12px] p-4">
            <p className="text-2xl font-bold text-ink">{card.value}</p>
            <p className="text-xs text-ink-3 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Test suites */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-ink mb-3">Test suites</h2>
        {project.user_types.length === 0 ? (
          <Link
            href={`/qa/admin/${projectId}/suite`}
            className="flex items-center justify-between p-4 bg-surface border border-warm-border rounded-[12px] hover:border-ink transition-colors group"
          >
            <div>
              <p className="text-sm font-medium text-ink">All test items</p>
              <p className="text-xs text-ink-3 mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
            </div>
            <svg className="w-4 h-4 text-ink-3 group-hover:text-ink transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {project.user_types.map((ut) => {
              const count = itemCountsByUserType[ut] ?? 0
              return (
                <Link
                  key={ut}
                  href={`/qa/admin/${projectId}/suite?userType=${encodeURIComponent(ut)}`}
                  className="flex items-center justify-between p-4 bg-surface border border-warm-border rounded-[12px] hover:border-ink transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{ut}</p>
                    <p className="text-xs text-ink-3 mt-0.5">{count} item{count !== 1 ? 's' : ''}</p>
                  </div>
                  <svg className="w-4 h-4 text-ink-3 group-hover:text-ink transition-colors shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Sessions table */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-ink mb-3">Tester sessions</h2>
        {sessions.length === 0 ? (
          <div className="bg-surface border border-warm-border rounded-[12px] p-6 text-center text-sm text-ink-3">
            No sessions yet. Activate this project so testers can begin.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-warm-border">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-canvas border-b border-warm-border">
                  {['Tester', 'User type', 'Viewport / OS / Browser', 'Progress', 'Pass', 'Fail', 'Blocked', 'Last active', 'Status', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-ink-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
                  return (
                    <tr key={s.id} className="border-b border-warm-border last:border-0 hover:bg-canvas">
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-medium text-ink">{s.tester_name}</p>
                        <p className="text-xs text-ink-3">{s.tester_email}</p>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-ink-2">{s.user_type}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs text-ink-2">{s.viewport} · {s.operating_system} · {s.browser}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[60px] h-1.5 bg-canvas rounded-full overflow-hidden">
                            <div className="h-full bg-ink rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-ink-2 whitespace-nowrap">{s.done}/{s.total} ({pct}%)</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-status-pass-text font-medium">{s.passed}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-status-fail-text font-medium">{s.failed}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-status-blocked-text font-medium">{s.blocked}</td>
                      <td className="px-3 py-2.5 text-xs text-ink-3 whitespace-nowrap">
                        {new Date(s.last_active_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          s.status === 'complete'
                            ? 'bg-status-pass border-status-pass-border text-status-pass-text'
                            : 'bg-canvas border-warm-border text-ink-2'
                        }`}>
                          {s.status === 'complete' ? 'Complete' : 'In progress'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {s.status !== 'complete' && <EndSessionButton sessionId={s.id} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Failures log */}
      <section>
        <h2 className="text-base font-semibold text-ink mb-3">Failure log</h2>
        <FailureLog initialFailures={failures} />
      </section>
    </main>
  )
}

// Client components
import { StatusChanger } from './StatusChanger'
import { EndSessionButton } from './EndSessionButton'
import { FailureLog } from '@/components/qa/FailureLog'
