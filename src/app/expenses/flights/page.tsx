import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { listTripsWithEmails } from '@/lib/db/flights'
import { FlightsClient } from './FlightsClient'

export const dynamic = 'force-dynamic'

export default async function FlightsPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (!isExpenseOwner(session.user.email)) redirect('/')

  const trips = await listTripsWithEmails()

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/expenses" className="text-sm text-ink-muted hover:text-ink transition-colors">
          ← Back to transactions
        </Link>
        <h1 className="font-display leading-tight tracking-tight text-2xl font-light text-ink mt-3 mb-1">Flights</h1>
        <p className="text-sm text-ink-muted mb-6">
          Airline emails from both inboxes (Jun 2025 – Jun 2026), grouped into trips. Tag each as
          business or personal, then check that every business trip has a submitted expense report.
        </p>
        <FlightsClient initialTrips={trips} />
      </div>
    </main>
  )
}
