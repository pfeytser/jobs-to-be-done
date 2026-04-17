import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getAllQAProjects } from '@/lib/db/qa-projects'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', active: 'Active', complete: 'Complete', archived: 'Archived',
}
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-canvas text-ink-3 border-warm-border',
  active: 'bg-status-pass text-status-pass-text border-status-pass-border',
  complete: 'bg-mist text-ink-2 border-warm-border',
  archived: 'bg-canvas text-ink-3 border-warm-border opacity-60',
}

export default async function QAAdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/qa')

  const projects = await getAllQAProjects()

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-2">
        <Link href="/admin" className="text-xs text-ink-3 hover:text-ink transition-colors">← Admin</Link>
      </div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">QA Projects</h1>
          <p className="text-sm text-ink-3">Manage projects, test suites, and view results.</p>
        </div>
        <Link
          href="/qa/admin/new"
          className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          + New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-ink-3">
          <p className="text-4xl mb-3">🧪</p>
          <p className="text-sm mb-4">No projects yet.</p>
          <Link
            href="/qa/admin/new"
            className="inline-block px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
          >
            Create first project
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="bg-surface border border-warm-border rounded-[14px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[p.status] ?? STATUS_STYLES.draft}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    <span className="text-xs text-ink-3">{p.platform}</span>
                  </div>
                  <h2 className="text-base font-semibold text-ink">{p.name}</h2>
                  {p.description && (
                    <p className="text-sm text-ink-2 mt-0.5 line-clamp-1">{p.description}</p>
                  )}
                  <p className="text-xs text-ink-3 mt-1">
                    Created {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <Link
                    href={`/qa/admin/${p.slug}/suite`}
                    className="px-3 py-1.5 text-xs font-medium bg-canvas border border-warm-border text-ink rounded-[6px] hover:border-ink transition-colors"
                  >
                    Test suite
                  </Link>
                  <Link
                    href={`/qa/admin/${p.slug}/upload`}
                    className="px-3 py-1.5 text-xs font-medium bg-canvas border border-warm-border text-ink rounded-[6px] hover:border-ink transition-colors"
                  >
                    Upload
                  </Link>
                  <Link
                    href={`/qa/admin/${p.slug}`}
                    className="px-3 py-1.5 text-xs font-semibold bg-ink text-white rounded-[6px] hover:opacity-90 transition-opacity"
                  >
                    Dashboard
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
