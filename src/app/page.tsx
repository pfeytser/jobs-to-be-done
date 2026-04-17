import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-ink mb-2">Welcome back</h1>
          <p className="text-sm text-ink-3">Where would you like to go?</p>
        </div>

        <div className="space-y-3">
          <Link
            href="/jtbd"
            className="flex items-center justify-between w-full p-5 bg-surface border border-warm-border rounded-[16px] hover:border-ink transition-colors group"
          >
            <div>
              <p className="text-base font-semibold text-ink">JTBD Exercises</p>
              <p className="text-sm text-ink-3 mt-0.5">Brainstorm and analyze jobs to be done</p>
            </div>
            <svg className="w-5 h-5 text-ink-3 group-hover:text-ink transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/qa"
            className="flex items-center justify-between w-full p-5 bg-surface border border-warm-border rounded-[16px] hover:border-ink transition-colors group"
          >
            <div>
              <p className="text-base font-semibold text-ink">QA Projects</p>
              <p className="text-sm text-ink-3 mt-0.5">Run and track QA testing sessions</p>
            </div>
            <svg className="w-5 h-5 text-ink-3 group-hover:text-ink transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
  )
}
