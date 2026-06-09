import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { listTripsWithEmails, type TripCategory } from '@/lib/db/flights'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const cat = req.nextUrl.searchParams.get('category') as TripCategory | null
    const valid: TripCategory[] = ['uncategorized', 'business', 'personal']
    const trips = await listTripsWithEmails(cat && valid.includes(cat) ? cat : undefined)
    return NextResponse.json({ trips })
  } catch (error) {
    console.error('[expenses/flights GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
