import { NextRequest, NextResponse } from 'next/server'
import { requireExpenseOwner, route } from '@/lib/auth/guards'
import { listTripsWithEmails, type TripCategory } from '@/lib/db/flights'

export const GET = route(async (req: NextRequest) => {
  await requireExpenseOwner()

  const cat = req.nextUrl.searchParams.get('category') as TripCategory | null
  const valid: TripCategory[] = ['uncategorized', 'business', 'personal']
  const trips = await listTripsWithEmails(cat && valid.includes(cat) ? cat : undefined)
  return NextResponse.json({ trips })
})
