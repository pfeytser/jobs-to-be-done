import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { listEmailAccounts, toSafe } from '@/lib/db/email-accounts'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const accounts = (await listEmailAccounts()).map(toSafe)
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('[expenses/accounts GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
