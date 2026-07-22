import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getWorkshopById,
  getItems,
  syncItems,
  reconcileCategoryRankings,
  resetPhaseSubmissions,
} from '@/lib/db/workshops'
import { z } from 'zod'

const ItemSchema = z.object({
  id: z.string().max(80).optional(),
  category: z.string().min(1).max(120),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().default(''),
})

const BodySchema = z.object({ items: z.array(ItemSchema).max(500) })

function canManage(user: { role: string; userId: string }, createdBy: string): boolean {
  return user.role === 'admin' || createdBy === user.userId
}

// Items may be edited while the workshop is in draft, or by the facilitator
// during the category round (round 1). Editing is locked once the group has
// advanced to the combined round, so the frozen top-N stays meaningful.
const EDITABLE_STATUSES = ['draft', 'ranking_categories']

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const workshop = await getWorkshopById(id)
  if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, workshop.created_by) && workshop.status === 'draft') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ items: await getItems(id) })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const workshop = await getWorkshopById(id)
  if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, workshop.created_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!EDITABLE_STATUSES.includes(workshop.status)) {
    return NextResponse.json(
      { error: 'Items can only be edited in draft or during the category round' },
      { status: 409 }
    )
  }

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const { items, structural } = await syncItems(id, parsed.data.items)

  // Live edits during round 1: keep everyone's orderings valid, and if the edit
  // was structural, send submitters back to re-rank the corrected set.
  let submissionsReset = false
  if (workshop.status === 'ranking_categories') {
    await reconcileCategoryRankings(id)
    if (structural) {
      await resetPhaseSubmissions(id, 'categories')
      submissionsReset = true
    }
  }

  return NextResponse.json({ items, structural, submissionsReset })
})
