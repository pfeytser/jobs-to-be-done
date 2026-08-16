import { NextRequest, NextResponse } from 'next/server'
import { requireExpenseOwner, route } from '@/lib/auth/guards'
import { getTripById, setTripCategory, type TripCategory } from '@/lib/db/flights'

// Set a trip's category: business | personal | uncategorized.
export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireExpenseOwner()

  const { id } = await params
  const { category } = (await req.json()) as { category?: string }
  const valid: TripCategory[] = ['uncategorized', 'business', 'personal']
  if (!category || !valid.includes(category as TripCategory)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  const trip = await getTripById(id)
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await setTripCategory(id, category as TripCategory)
  return NextResponse.json({ ok: true })
})
