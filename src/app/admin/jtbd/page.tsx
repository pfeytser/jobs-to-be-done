import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { AdminPanel } from '@/components/AdminPanel'

export const dynamic = 'force-dynamic'

export default async function JTBDAdminPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'admin') {
    redirect('/jtbd')
  }

  return (
    <div className="min-h-screen bg-canvas">
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink mb-1">JTBD Exercise</h1>
          <p className="text-ink-3 text-sm">
            Manage exercises, set phases, and track voting progress.
          </p>
        </div>

        <AdminPanel />
      </main>
    </div>
  )
}
