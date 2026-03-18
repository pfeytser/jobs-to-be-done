import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { AdminPanel } from '@/components/AdminPanel'
import { signOut } from '@/lib/auth/config'

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
      <header className="bg-surface border-b border-warm-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/jtbd" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
              <span className="text-xl">🐝</span>
              <span className="font-semibold text-ink">Jobs to Bee Done</span>
            </Link>
            <span className="px-2.5 py-0.5 bg-sand text-ink rounded-full text-xs font-semibold">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? 'Admin'}
                className="w-7 h-7 rounded-full object-cover"
              />
            )}
            <span className="text-sm text-ink-2 hidden sm:block">
              {session.user.name ?? session.user.email}
            </span>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/auth/signin' })
              }}
            >
              <button
                type="submit"
                className="text-xs text-ink-3 hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink mb-1">Workshop Admin</h1>
          <p className="text-ink-3 text-sm">
            Manage exercises, set phases, and track voting progress.
          </p>
        </div>

        <AdminPanel />
      </main>
    </div>
  )
}
