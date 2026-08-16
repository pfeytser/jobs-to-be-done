import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getProjectById,
  getThemes,
  activateProject,
  revealProject,
  reopenProject,
  updateProjectName,
  updateAxisLabels,
  deleteProject,
  getProgressStats,
  getParticipant,
} from '@/lib/db/quadrants'
import { z } from 'zod'

const AxisLabelsSchema = z.object({
  horizontalAxis: z.string().min(1).max(80),
  verticalAxis: z.string().min(1).max(80),
  horizontalLeft: z.string().min(1).max(80),
  horizontalRight: z.string().min(1).max(80),
  verticalTop: z.string().min(1).max(80),
  verticalBottom: z.string().min(1).max(80),
  quadrants: z.object({
    table_stakes_floor: z.string().min(1).max(80),
    signature: z.string().min(1).max(80),
    cut_or_defer: z.string().min(1).max(80),
    distinctive_bet: z.string().min(1).max(80),
  }),
})

const PatchSchema = z.union([
  z.object({ action: z.literal('update-name'), name: z.string().min(1).max(200) }),
  z.object({ action: z.literal('update-labels'), axisLabels: AxisLabelsSchema }),
  z.object({ action: z.enum(['activate', 'reveal', 'reopen']) }),
])

function canManage(user: { role: string; userId: string }, createdBy: string): boolean {
  return user.role === 'admin' || createdBy === user.userId
}

/**
 * Poll-safe status endpoint. Returns just enough to know when to refresh and to
 * render the monitor tally. Per-participant names are admin-only; drafts (setup)
 * are hidden from non-admins.
 */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = user.role === 'admin'
  if (!isAdmin && project.status === 'setup') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let doneCount = 0
  let participantCount = 0
  let doneNames: string[] | undefined
  let pendingNames: string[] | undefined
  let myStatus: 'in_progress' | 'done' | null = null

  if (project.status !== 'setup') {
    const stats = await getProgressStats(id)
    doneCount = stats.doneCount
    participantCount = stats.participantCount
    if (isAdmin) {
      doneNames = stats.doneNames
      pendingNames = stats.pendingNames
    }
    const me = await getParticipant(id, user.userId)
    myStatus = me?.status ?? null
  }

  return NextResponse.json({
    id: project.id,
    status: project.status,
    updatedAt: project.updated_at,
    doneCount,
    participantCount,
    myStatus,
    ...(doneNames ? { doneNames, pendingNames } : {}),
  })
})

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params

  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, project.created_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { action } = parsed.data

  if (action === 'update-name') {
    return NextResponse.json({ project: await updateProjectName(id, parsed.data.name) })
  }

  if (action === 'update-labels') {
    return NextResponse.json({ project: await updateAxisLabels(id, parsed.data.axisLabels) })
  }

  if (action === 'activate') {
    if (project.status !== 'setup') {
      return NextResponse.json({ error: 'Only projects in setup can be started' }, { status: 409 })
    }
    const themes = await getThemes(id)
    if (themes.length < 1) {
      return NextResponse.json({ error: 'Add at least one theme before starting.' }, { status: 409 })
    }
    return NextResponse.json({ project: await activateProject(id) })
  }

  if (action === 'reveal') {
    if (project.status !== 'active') {
      return NextResponse.json({ error: 'The workshop is not running' }, { status: 409 })
    }
    return NextResponse.json({ project: await revealProject(id) })
  }

  // reopen
  if (project.status !== 'reveal') {
    return NextResponse.json({ error: 'Nothing to reopen from this state' }, { status: 409 })
  }
  // Reopening lets people change their placements, which would make the frozen
  // snapshot no longer match the underlying votes. Once decisions have started,
  // the decided board is the way forward.
  if (project.frozen_at) {
    return NextResponse.json(
      { error: 'This vote is frozen — evolve it on the decided board instead of reopening.' },
      { status: 409 }
    )
  }
  return NextResponse.json({ project: await reopenProject(id) })
})

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, project.created_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (project.status !== 'setup') {
    return NextResponse.json({ error: 'Only projects in setup can be deleted' }, { status: 409 })
  }
  await deleteProject(id)
  return NextResponse.json({ ok: true })
})
