import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'admin') {
    redirect('/jtbd')
  }

  return (
    <div className="min-h-screen bg-canvas">
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-ink mb-1">Admin</h1>
        <p className="text-sm text-ink-3 mb-8">Choose an activity to manage.</p>

        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-3">Activities</h2>

          <Link
            href="/admin/jtbd"
            className="flex items-center gap-4 p-5 bg-surface border border-warm-border rounded-[14px] hover:border-ink transition-colors group"
          >
            <span className="text-3xl">🐝</span>
            <div className="flex-1">
              <p className="text-base font-semibold text-ink">JTBD Exercise</p>
              <p className="text-sm text-ink-3">Create and run Jobs to Be Done or Sentiment Design workshops</p>
            </div>
            <svg className="w-5 h-5 text-ink-3 group-hover:text-ink transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/qa/admin"
            className="flex items-center gap-4 p-5 bg-surface border border-warm-border rounded-[14px] hover:border-ink transition-colors group"
          >
            <span className="text-3xl">🧪</span>
            <div className="flex-1">
              <p className="text-base font-semibold text-ink">QA Project</p>
              <p className="text-sm text-ink-3">Set up test suites and track volunteer QA sessions</p>
            </div>
            <svg className="w-5 h-5 text-ink-3 group-hover:text-ink transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/admin/storyboard"
            className="flex items-center gap-4 p-5 bg-surface border border-warm-border rounded-[14px] hover:border-ink transition-colors group"
          >
            <span className="text-3xl">🎬</span>
            <div className="flex-1">
              <p className="text-base font-semibold text-ink">Storyboard</p>
              <p className="text-sm text-ink-3">Create and manage storyboard use cases for collaborators</p>
            </div>
            <svg className="w-5 h-5 text-ink-3 group-hover:text-ink transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </main>
    </div>
  )
}
