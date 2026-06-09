import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { getTripById, setTripCategory, type TripCategory } from '@/lib/db/flights'

// Set a trip's category: business | personal | uncategorized.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
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
  } catch (error) {
    console.error('[expenses/flights/trips/:id PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
