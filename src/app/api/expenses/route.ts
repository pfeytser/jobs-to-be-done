import { NextRequest, NextResponse } from 'next/server'
import { requireExpenseOwner, route } from '@/lib/auth/guards'
import { listExpenses, getFilterOptions, type ExpenseFilters } from '@/lib/db/expenses'

export const GET = route(async (req: NextRequest) => {
  await requireExpenseOwner()

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
})
