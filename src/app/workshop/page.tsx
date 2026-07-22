import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getAllWorkshops, getVisibleWorkshops, type Workshop } from '@/lib/db/workshops'
import { CreateWorkshopForm } from './CreateWorkshopForm'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-canvas border-line text-ink-muted' },
  ranking_categories: { label: 'Round 1 · live', className: 'bg-accent text-ink' },
  ranking_combined: { label: 'Round 2 · live', className: 'bg-accent text-ink' },
  revealed: { label: 'Revealed', className: 'bg-pass-soft text-pass' },
  archived: { label: 'Archived', className: 'bg-canvas border-line text-ink-muted' },
}

function WorkshopRow({ w, isAdmin }: { w: Workshop; isAdmin: boolean }) {
  const meta = STATUS_META[w.status] ?? STATUS_META.draft
  const cta =
    w.status === 'ranking_categories' || w.status === 'ranking_combined'
      ? 'Rank →'
      : w.status === 'revealed'
        ? 'See results →'
        : isAdmin
          ? 'Open →'
          : ''
  return (
    <Link
      href={`/workshop/${w.id}`}
      className="flex items-center justify-between gap-4 p-5 bg-surface border border-line rounded-lg hover:border-ink hover:shadow-sm transition-all group"
    >
      <div className="min-w-0">
        <p className="text-lg font-bold text-ink truncate">{w.name}</p>
        {w.description && <p className="text-sm text-ink-soft mt-0.5 truncate">{w.description}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${meta.className}`}>{meta.label}</span>
        {cta && <span className="text-sm font-semibold text-ink-soft group-hover:text-ink">{cta}</span>}
      </div>
    </Link>
  )
}

export default async function WorkshopDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const isAdmin = session.user.role === 'admin'
  const workshops = isAdmin ? await getAllWorkshops() : await getVisibleWorkshops()

  const live = workshops.filter((w) => ['ranking_categories', 'ranking_combined'].includes(w.status))
  const drafts = workshops.filter((w) => w.status === 'draft')
  const revealed = workshops.filter((w) => w.status === 'revealed')
  const archived = workshops.filter((w) => w.status === 'archived')

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">← Home</Link>
        <header className="mt-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-accent/20 border border-accent/40 mb-3">
            <span className="text-base">🗂️</span>
            <span className="text-xs font-bold tracking-wide text-ink uppercase">Prioritization</span>
          </div>
          <h1 className="font-display leading-tight text-4xl sm:text-5xl font-light text-ink tracking-tight">Workshops</h1>
          <p className="text-ink-soft mt-2 text-base">
            Rank items together, one category at a time, then as a group — and reveal the team&apos;s true priorities.
          </p>
        </header>

        {isAdmin && (
          <section className="mb-8">
            <CreateWorkshopForm />
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">🎯 Live now</h2>
          {live.length === 0 ? (
            <p className="text-ink-muted text-sm py-6 text-center bg-surface rounded-lg border border-line">
              No live workshops right now.
            </p>
          ) : (
            <div className="space-y-3">
              {live.map((w) => (
                <WorkshopRow key={w.id} w={w} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </section>

        {isAdmin && drafts.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">✍️ Drafts</h2>
            <div className="space-y-2.5">
              {drafts.map((w) => (
                <WorkshopRow key={w.id} w={w} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}

        {revealed.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">🏁 Revealed</h2>
            <div className="space-y-2">
              {revealed.map((w) => (
                <WorkshopRow key={w.id} w={w} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}

        {isAdmin && archived.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-3">🗄️ Archived</h2>
            <div className="space-y-2">
              {archived.map((w) => (
                <WorkshopRow key={w.id} w={w} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
