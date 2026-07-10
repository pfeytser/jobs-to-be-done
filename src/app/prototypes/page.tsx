import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getAllPrototypes, getActivePrototypes } from '@/lib/db/prototypes'
import { PrototypeRowControls } from './PrototypeRowControls'
import { CopyLinkButton } from './CopyLinkButton'

export const dynamic = 'force-dynamic'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function PrototypesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const isAdmin = session.user.role === 'admin'
  const prototypes = isAdmin ? await getAllPrototypes() : await getActivePrototypes()

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display leading-tight tracking-tight text-2xl font-light text-ink mb-1">Prototypes</h1>
          <p className="text-sm text-ink-muted">Hosted HTML prototypes, shareable with anyone at Industrious.</p>
        </div>
        {isAdmin && (
          <Link
            href="/prototypes/new"
            className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            + New prototype
          </Link>
        )}
      </div>

      {prototypes.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-4xl mb-3">🧩</p>
          <p className="text-sm mb-4">No prototypes yet.</p>
          {isAdmin && (
            <Link
              href="/prototypes/new"
              className="inline-block px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
            >
              Upload the first one
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {prototypes.map((p) => (
            <div key={p.id} className={`bg-surface border border-line rounded-md p-5 ${p.status === 'archived' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {p.status === 'archived' && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-canvas text-ink-muted border-line font-medium">
                        Archived
                      </span>
                    )}
                    {p.created_via === 'api' && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-info text-ink-soft border-line font-medium">
                        via Claude
                      </span>
                    )}
                  </div>
                  <Link href={`/prototypes/${p.slug}`} className="text-base font-semibold text-ink hover:opacity-75 transition-opacity">
                    {p.name}
                  </Link>
                  <p className="text-xs text-ink-muted mt-1">
                    /prototypes/{p.slug} · {formatBytes(p.file_size)} · updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-start gap-2 shrink-0 flex-wrap justify-end">
                  <CopyLinkButton slug={p.slug} />
                  {isAdmin && (
                    <PrototypeRowControls id={p.id} name={p.name} status={p.status} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
