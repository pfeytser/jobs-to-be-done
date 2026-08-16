import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getAllProjects, getVisibleProjects, type QuadProject } from '@/lib/db/quadrants'
import { CreateProjectForm } from './CreateProjectForm'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { label: string; className: string }> = {
  setup: { label: 'Setup', className: 'bg-canvas border-line text-ink-muted' },
  active: { label: 'Live', className: 'bg-accent text-ink' },
  reveal: { label: 'Revealed', className: 'bg-pass-soft text-pass' },
}

function ProjectRow({ p, isAdmin }: { p: QuadProject; isAdmin: boolean }) {
  const meta = STATUS_META[p.status] ?? STATUS_META.setup
  const cta =
    p.status === 'active' ? 'Place themes →' : p.status === 'reveal' ? 'See results →' : isAdmin ? 'Open →' : ''
  return (
    <Link
      href={`/quadrant/${p.id}`}
      className="flex items-center justify-between gap-4 p-5 bg-surface border border-line rounded-lg hover:border-ink hover:shadow-sm transition-all group"
    >
      <div className="min-w-0">
        <p className="text-lg font-bold text-ink truncate">{p.name}</p>
        <p className="text-sm text-ink-soft mt-0.5">Theme prioritization · 2×2</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${meta.className}`}>{meta.label}</span>
        {cta && <span className="text-sm font-semibold text-ink-soft group-hover:text-ink">{cta}</span>}
      </div>
    </Link>
  )
}

export default async function QuadrantDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const isAdmin = session.user.role === 'admin'
  const projects = isAdmin ? await getAllProjects() : await getVisibleProjects()

  const live = projects.filter((p) => p.status === 'active')
  const setup = projects.filter((p) => p.status === 'setup')
  const revealed = projects.filter((p) => p.status === 'reveal')

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">← Home</Link>
        <header className="mt-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-accent/20 border border-accent/40 mb-3">
            <span className="text-base">◳</span>
            <span className="text-xs font-bold tracking-wide text-ink uppercase">Prioritization grid</span>
          </div>
          <h1 className="font-display leading-tight text-4xl sm:text-5xl font-light text-ink tracking-tight">
            Theme prioritization
          </h1>
          <p className="text-ink-soft mt-2 text-base">
            Drag every theme into a 2×2 of distinctiveness × importance — then reveal where the group lands and what
            it&apos;s split on.
          </p>
        </header>

        {isAdmin && (
          <section className="mb-8">
            <CreateProjectForm />
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">Live now</h2>
          {live.length === 0 ? (
            <p className="text-ink-muted text-sm py-6 text-center bg-surface rounded-lg border border-line">
              No live workshops right now.
            </p>
          ) : (
            <div className="space-y-3">
              {live.map((p) => (
                <ProjectRow key={p.id} p={p} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </section>

        {isAdmin && setup.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">Setup</h2>
            <div className="space-y-2.5">
              {setup.map((p) => (
                <ProjectRow key={p.id} p={p} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}

        {revealed.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">Revealed</h2>
            <div className="space-y-2">
              {revealed.map((p) => (
                <ProjectRow key={p.id} p={p} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
