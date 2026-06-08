import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { listExpenses, getFilterOptions, type ExpenseFilters } from '@/lib/db/expenses'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const sp = req.nextUrl.searchParams
    const filters: ExpenseFilters = {
      match_status: sp.get('match_status') ?? undefined,
      expense_date_from: sp.get('expense_date_from') ?? undefined,
      expense_date_to: sp.get('expense_date_to') ?? undefined,
      statement_date_from: sp.get('statement_date_from') ?? undefined,
      statement_date_to: sp.get('statement_date_to') ?? undefined,
      merchant: sp.get('merchant') ?? undefined,
      category: sp.get('category') ?? undefined,
      report_name: sp.get('report_name') ?? undefined,
      reimburse_to_employee: sp.get('reimburse_to_employee') ?? undefined,
      source_file_name: sp.get('source_file_name') ?? undefined,
    }
    const sortBy = sp.get('sort_by') ?? 'expense_date'
    const sortDir = sp.get('sort_dir') === 'asc' ? 'asc' : 'desc'

    const [transactions, options] = await Promise.all([
      listExpenses(filters, sortBy, sortDir),
      getFilterOptions(),
    ])

    return NextResponse.json({ transactions, options })
  } catch (error) {
    console.error('[expenses GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
