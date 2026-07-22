import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getWorkshopById,
  getItems,
  activateWorkshop,
  advanceToCombined,
  revealWorkshop,
  archiveWorkshop,
  unarchiveWorkshop,
  reopenWorkshop,
  deleteWorkshop,
  updateWorkshopDimensions,
  getSubmissionStats,
  getRankingsForUserPhase,
  phaseForStatus,
} from '@/lib/db/workshops'
import { z } from 'zod'

const DimensionEditSchema = z.object({
  key: z.enum(['stickiness', 'differentiation']),
  name: z.string().min(1).max(60),
  description: z.string().max(200).optional().default(''),
})

// `update-dimensions` carries a payload; the other actions are bare.
const PatchSchema = z.union([
  z.object({ action: z.literal('update-dimensions'), dimensions: z.array(DimensionEditSchema).max(2) }),
  z.object({ action: z.enum(['activate', 'advance', 'reveal', 'reopen', 'archive', 'unarchive']) }),
])

function canManage(user: { role: string; userId: string }, createdBy: string): boolean {
  return user.role === 'admin' || createdBy === user.userId
}

/**
 * Poll-safe status endpoint. Returns just enough for the client to know when to
 * refresh and to render the waiting-room tally — never leaks other users' orders.
 * Per-participant names are admin-only.
 */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const workshop = await getWorkshopById(id)
  if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = user.role === 'admin'
  // Non-admins can't poll drafts or archived workshops.
  if (!isAdmin && ['draft', 'archived'].includes(workshop.status)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const phase = phaseForStatus(workshop.status)
  let mySubmitted = false
  let submittedCount = 0
  let participantCount = 0
  let submittedNames: string[] | undefined
  let pendingNames: string[] | undefined

  if (phase) {
    const stats = await getSubmissionStats(id, phase)
    submittedCount = stats.submittedCount
    participantCount = stats.participantCount
    if (isAdmin) {
      submittedNames = stats.submittedNames
      pendingNames = stats.pendingNames
    }
    const mine = await getRankingsForUserPhase(id, user.userId, phase)
    mySubmitted = mine.length > 0 && mine.every((r) => r.submitted)
  }

  return NextResponse.json({
    id: workshop.id,
    status: workshop.status,
    updatedAt: workshop.updated_at,
    phase,
    mySubmitted,
    submittedCount,
    participantCount,
    ...(submittedNames ? { submittedNames, pendingNames } : {}),
  })
})

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params

  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const workshop = await getWorkshopById(id)
  if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, workshop.created_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { action } = parsed.data

  if (action === 'update-dimensions') {
    if (workshop.mode !== 'multi') {
      return NextResponse.json({ error: 'This workshop has no dimensions to edit' }, { status: 409 })
    }
    return NextResponse.json({ workshop: await updateWorkshopDimensions(id, parsed.data.dimensions) })
  }

  if (action === 'activate') {
    if (workshop.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft workshops can be activated' }, { status: 409 })
    }
    const items = await getItems(id)
    if (items.length < 2) {
      return NextResponse.json(
        { error: 'Add at least two items before activating.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ workshop: await activateWorkshop(id) })
  }

  if (action === 'advance') {
    // Only single mode has a combined round; multi mode reveals from categories.
    if (workshop.mode === 'multi') {
      return NextResponse.json({ error: 'This workshop reveals directly from the ranking round' }, { status: 409 })
    }
    if (workshop.status !== 'ranking_categories') {
      return NextResponse.json({ error: 'Workshop is not in the category round' }, { status: 409 })
    }
    const stats = await getSubmissionStats(id, 'categories')
    if (stats.submittedCount === 0) {
      return NextResponse.json(
        { error: 'No one has submitted their category rankings yet.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ workshop: await advanceToCombined(id) })
  }

  if (action === 'reveal') {
    // Single mode reveals from the combined round; multi mode from the category round.
    const revealPhase =
      workshop.mode === 'multi' && workshop.status === 'ranking_categories'
        ? 'categories'
        : workshop.status === 'ranking_combined'
          ? 'combined'
          : null
    if (!revealPhase) {
      return NextResponse.json({ error: 'Workshop is not ready to reveal' }, { status: 409 })
    }
    const stats = await getSubmissionStats(id, revealPhase)
    if (stats.submittedCount === 0) {
      return NextResponse.json(
        { error: 'No one has submitted their rankings yet.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ workshop: await revealWorkshop(id) })
  }

  if (action === 'reopen') {
    if (!['ranking_combined', 'revealed'].includes(workshop.status)) {
      return NextResponse.json({ error: 'Nothing to reopen from this state' }, { status: 409 })
    }
    return NextResponse.json({ workshop: await reopenWorkshop(id) })
  }

  if (action === 'unarchive') {
    if (workshop.status !== 'archived') {
      return NextResponse.json({ error: 'Only archived workshops can be unarchived' }, { status: 409 })
    }
    return NextResponse.json({ workshop: await unarchiveWorkshop(id) })
  }

  // archive — allowed from any non-draft state.
  if (workshop.status === 'draft') {
    return NextResponse.json({ error: 'Delete drafts instead of archiving them' }, { status: 409 })
  }
  return NextResponse.json({ workshop: await archiveWorkshop(id) })
})

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const workshop = await getWorkshopById(id)
  if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, workshop.created_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (workshop.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft workshops can be deleted' }, { status: 409 })
  }
  await deleteWorkshop(id)
  return NextResponse.json({ ok: true })
})
