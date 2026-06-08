import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { ImportClient } from './ImportClient'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (!isExpenseOwner(session.user.email)) redirect('/')

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Link href="/expenses" className="text-sm text-ink-3 hover:text-ink transition-colors">
            ← Back to transactions
          </Link>
          <h1 className="text-2xl font-bold text-ink mt-2">Import Coupa Export</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            Upload one or more Coupa CSV exports. Rows are de-duplicated automatically, so
            re-importing the same file is safe.
          </p>
        </div>
        <ImportClient />
      </div>
    </main>
  )
}
