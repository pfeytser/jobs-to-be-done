import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { getExpenseById } from '@/lib/db/expenses'
import { getEnrichedMatchesForExpense } from '@/lib/db/receipts'
import { ExpenseDetail } from './ExpenseDetail'

export const dynamic = 'force-dynamic'

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (!isExpenseOwner(session.user.email)) redirect('/')

  const { id } = await params
  const expense = await getExpenseById(id)
  if (!expense) notFound()

  const matches = await getEnrichedMatchesForExpense(id)

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/expenses" className="text-sm text-ink-3 hover:text-ink transition-colors">
          ← Back to transactions
        </Link>
        <ExpenseDetail expense={expense} matches={matches} />
      </div>
    </main>
  )
}
