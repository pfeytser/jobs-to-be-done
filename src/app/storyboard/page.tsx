import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getAllUseCases, getActiveUseCases } from '@/lib/db/storyboard-use-cases'
import { AdminNav } from '@/components/AdminNav'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  create: 'Open',
  present: 'Presenting',
  archive: 'Archived',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  create: 'bg-blue-100 text-blue-800',
  present: 'bg-green-100 text-green-800',
  archive: 'bg-gray-100 text-gray-500',
}

export default async function StoryboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const useCases = session.user.role === 'admin'
    ? await getAllUseCases()
    : await getActiveUseCases()

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-warm-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-ink-3 hover:text-ink transition-colors text-sm">
              ← Home
            </Link>
            <span className="text-ink-3">/</span>
            <span className="font-semibold text-ink">Storyboard</span>
          </div>
          <AdminNav role={session.user.role} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink mb-1">Storyboards</h1>
          <p className="text-sm text-ink-3">Select a use case to create or view your storyboard.</p>
        </div>

        {useCases.length === 0 ? (
          <div className="text-sm text-ink-3 py-12 text-center">
            No storyboard use cases are available yet.
            {session.user.role === 'admin' && (
              <> <Link href="/admin/storyboard" className="underline hover:text-ink">Create one in admin.</Link></>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {useCases.map((uc) => (
              <Link
                key={uc.id}
                href={`/storyboard/${uc.id}`}
                className="flex items-center gap-4 p-5 bg-surface border border-warm-border rounded-[14px] hover:border-ink transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-ink">{uc.name}</p>
                  {uc.description && (
                    <p className="text-sm text-ink-3 mt-0.5 line-clamp-2">{uc.description}</p>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[uc.status]}`}>
                  {STATUS_LABELS[uc.status]}
                </span>
                <svg className="w-5 h-5 text-ink-3 group-hover:text-ink transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
