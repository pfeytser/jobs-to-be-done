import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { listExpenses, getFilterOptions } from '@/lib/db/expenses'
import { ExpensesTable } from './ExpensesTable'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  // Private workspace — pretend it doesn't exist for anyone but the owner.
  if (!isExpenseOwner(session.user.email)) redirect('/')

  const [transactions, options] = await Promise.all([
    listExpenses({}, 'expense_date', 'desc'),
    getFilterOptions(),
  ])

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <ExpensesTable initialTransactions={transactions} initialOptions={options} />
      </div>
    </main>
  )
}
