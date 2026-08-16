import { NextResponse } from 'next/server'
import { requireExpenseOwner, route } from '@/lib/auth/guards'
import { listEmailAccounts, toSafe } from '@/lib/db/email-accounts'

export const GET = route(async () => {
  await requireExpenseOwner()

  const accounts = (await listEmailAccounts()).map(toSafe)
  return NextResponse.json({ accounts })
})
