import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getWorkshopById,
  getItems,
  getCombinedItemIds,
  getOrSeedUserRankings,
  getRankingsForUserPhase,
  saveRankingOrder,
  submitRankings,
  getSubmissionStats,
  phaseForStatus,
  COMBINED_CATEGORY,
} from '@/lib/db/workshops'
import { z } from 'zod'

const SaveSchema = z.object({
  action: z.literal('save'),
  category: z.string().max(120),
  orderedItemIds: z.array(z.string().max(80)).max(500),
})

const SubmitSchema = z.object({ action: z.literal('submit') })

const BodySchema = z.union([SaveSchema, SubmitSchema])

/** The set of item ids a user is expected to rank, per category, in a phase. */
async function expectedByCategory(
  workshopId: string,
  phase: 'categories' | 'combined'
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>()
  if (phase === 'categories') {
    const items = await getItems(workshopId)
    for (const it of items) {
      if (!map.has(it.category)) map.set(it.category, new Set())
      map.get(it.category)!.add(it.id)
    }
  } else {
    map.set(COMBINED_CATEGORY, new Set(await getCombinedItemIds(workshopId)))
  }
  return map
}

function isPermutation(order: string[], expected: Set<string>): boolean {
  if (order.length !== expected.size) return false
  const seen = new Set(order)
  if (seen.size !== order.length) return false
  for (const id of order) if (!expected.has(id)) return false
  return true
}

/** Returns (seeding if needed) the caller's own rankings + waiting-room tally. */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const workshop = await getWorkshopById(id)
  if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const phase = phaseForStatus(workshop.status)
  if (!phase) return NextResponse.json({ error: 'Workshop is not accepting rankings' }, { status: 409 })

  const rankings = await getOrSeedUserRankings(
    id,
    { userId: user.userId, name: user.name ?? user.email ?? '', email: user.email ?? '' },
    phase
  )
  const stats = await getSubmissionStats(id, phase)
  return NextResponse.json({
    phase,
    rankings: rankings.map((r) => ({ category: r.category, orderedItemIds: r.ordered_item_ids, submitted: r.submitted })),
    submittedCount: stats.submittedCount,
    participantCount: stats.participantCount,
  })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const workshop = await getWorkshopById(id)
  if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const phase = phaseForStatus(workshop.status)
  if (!phase) return NextResponse.json({ error: 'Workshop is not accepting rankings' }, { status: 409 })

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  // Guard against writing to another user's rows: everything is scoped to userId.
  const mine = await getRankingsForUserPhase(id, user.userId, phase)
  const alreadySubmitted = mine.length > 0 && mine.every((r) => r.submitted)
  const expected = await expectedByCategory(id, phase)

  if (parsed.data.action === 'save') {
    if (alreadySubmitted) {
      return NextResponse.json({ error: 'You already submitted this round' }, { status: 409 })
    }
    const expectedSet = expected.get(parsed.data.category)
    if (!expectedSet) {
      return NextResponse.json({ error: 'Unknown category' }, { status: 400 })
    }
    if (!isPermutation(parsed.data.orderedItemIds, expectedSet)) {
      return NextResponse.json({ error: 'Order must include exactly the items in this category' }, { status: 400 })
    }
    await saveRankingOrder(id, user.userId, phase, parsed.data.category, parsed.data.orderedItemIds)
    return NextResponse.json({ ok: true })
  }

  // submit — validate every category the user must rank is a complete ordering.
  const byCategory = new Map(mine.map((r) => [r.category, r.ordered_item_ids]))
  for (const [category, expectedSet] of expected) {
    const order = byCategory.get(category) ?? []
    if (!isPermutation(order, expectedSet)) {
      return NextResponse.json(
        { error: 'Finish ranking every item before submitting.' },
        { status: 409 }
      )
    }
  }
  await submitRankings(id, user.userId, phase)
  return NextResponse.json({ ok: true })
})
