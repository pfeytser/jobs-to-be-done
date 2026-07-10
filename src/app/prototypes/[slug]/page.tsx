import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getPrototypeBySlug } from '@/lib/db/prototypes'

export const dynamic = 'force-dynamic'

export default async function PrototypeViewerPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const { slug } = await params
  const prototype = await getPrototypeBySlug(slug)
  if (!prototype) notFound()
  if (prototype.status !== 'active' && session.user.role !== 'admin') notFound()

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="flex items-center justify-between gap-4 px-6 py-2.5 border-b border-line bg-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/prototypes" className="text-xs text-ink-muted hover:text-ink transition-colors shrink-0">
            ← Prototypes
          </Link>
          <span className="text-sm font-semibold text-ink truncate">{prototype.name}</span>
          {prototype.status === 'archived' && (
            <span className="text-xs px-2 py-0.5 rounded-full border bg-canvas text-ink-muted border-line font-medium shrink-0">
              Archived
            </span>
          )}
        </div>
        {session.user.role === 'admin' && (
          <Link href="/prototypes" className="text-xs text-ink-muted hover:text-ink transition-colors shrink-0">
            Manage
          </Link>
        )}
      </div>
      <iframe
        src={`/api/prototypes/${prototype.id}/render`}
        sandbox="allow-scripts allow-forms allow-popups allow-modals"
        className="w-full flex-1 border-0"
        title={prototype.name}
      />
    </div>
  )
}
