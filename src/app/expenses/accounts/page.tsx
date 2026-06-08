import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { listEmailAccounts, toSafe } from '@/lib/db/email-accounts'
import { AccountsClient } from './AccountsClient'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (!isExpenseOwner(session.user.email)) redirect('/')

  const accounts = (await listEmailAccounts()).map(toSafe)
  const configured = !!(
    process.env.GOOGLE_RECEIPT_CLIENT_ID &&
    process.env.GOOGLE_RECEIPT_CLIENT_SECRET &&
    process.env.GOOGLE_RECEIPT_REDIRECT_URI
  )

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/expenses" className="text-sm text-ink-3 hover:text-ink transition-colors">
          ← Back to transactions
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-3 mb-1">Connected Gmail accounts</h1>
        <p className="text-sm text-ink-3 mb-6">
          Connect your work and personal Gmail so the matcher can search both for receipts.
          Read-only access; tokens are encrypted at rest.
        </p>
        <AccountsClient initialAccounts={accounts} configured={configured} />
      </div>
    </main>
  )
}
