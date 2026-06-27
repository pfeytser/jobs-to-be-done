import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getActiveQAProjects } from '@/lib/db/qa-projects'
import { getAllQAProjects } from '@/lib/db/qa-projects'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  complete: 'Complete',
  archived: 'Archived',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-canvas text-ink-muted border-line',
  active: 'bg-pass-soft text-pass border-pass-line',
  complete: 'bg-info text-ink-soft border-line',
  archived: 'bg-canvas text-ink-muted border-line',
}

export default async function QAHomePage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const projects =
    session.user.role === 'admin'
      ? await getAllQAProjects()
      : await getActiveQAProjects()

  return (
    <main className="max-w-content mx-auto px-6 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display leading-tight tracking-tight text-2xl font-light text-ink mb-1">QA Projects</h1>
          <p className="text-sm text-ink-muted">
            {session.user.role === 'admin'
              ? 'All projects — click one to manage it.'
              : 'Choose a project to start or resume a testing session.'}
          </p>
        </div>
        {session.user.role === 'admin' && (
          <Link
            href="/qa/admin"
            className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Admin panel
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-4xl mb-3">🧪</p>
          <p className="text-sm">
            {session.user.role === 'admin'
              ? 'No projects yet. Create one in the admin panel.'
              : 'No active projects right now. Check back soon.'}
          </p>
          {session.user.role === 'admin' && (
            <Link
              href="/qa/admin/new"
              className="mt-4 inline-block px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
            >
              Create first project
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={session.user.role === 'admin' ? `/qa/admin/${p.slug}` : `/qa/${p.slug}`}
              className="block bg-surface border border-line rounded-md p-5 hover:border-ink transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[p.status] ?? STATUS_STYLES.draft}`}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    <span className="text-xs text-ink-muted">{p.platform}</span>
                  </div>
                  <h2 className="text-base font-semibold text-ink group-hover:underline">{p.name}</h2>
                  {p.description && (
                    <p className="text-sm text-ink-soft mt-0.5 line-clamp-2">{p.description}</p>
                  )}
                </div>
                <svg className="w-4 h-4 text-ink-muted group-hover:text-ink transition-colors shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              {p.user_types.length > 0 && (
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  {p.user_types.slice(0, 5).map((ut) => (
                    <span key={ut} className="text-xs px-2 py-0.5 bg-canvas border border-line text-ink-soft rounded-full">
                      {ut}
                    </span>
                  ))}
                  {p.user_types.length > 5 && (
                    <span className="text-xs text-ink-muted">+{p.user_types.length - 5} more</span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
