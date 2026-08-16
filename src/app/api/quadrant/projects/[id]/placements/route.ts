import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getProjectById,
  getThemes,
  getOrCreateParticipant,
  getPlacementsForUser,
  upsertPlacement,
  QUADRANT_KEYS,
  type QuadrantKey,
} from '@/lib/db/quadrants'
import { z } from 'zod'

const QuadrantKeySchema = z.enum(QUADRANT_KEYS as unknown as [string, ...string[]])

const PostSchema = z.object({
  themeId: z.string().min(1).max(80),
  quadrantKey: QuadrantKeySchema.nullable(),
})

function displayName(user: { name?: string | null; email?: string | null }): string {
  return (user.name ?? user.email ?? 'Someone').slice(0, 120)
}

/** The caller's own placements + status. Registers them as a participant. */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.status === 'setup') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const participant = await getOrCreateParticipant(id, {
    userId: user.userId,
    displayName: displayName(user),
    role: user.role === 'admin' ? 'admin' : 'collaborator',
  })
  const placements = await getPlacementsForUser(id, user.userId)
  const map: Record<string, QuadrantKey | null> = {}
  for (const p of placements) map[p.theme_id] = p.quadrant_key
  return NextResponse.json({ placements: map, status: participant.status })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.status !== 'active') {
    return NextResponse.json({ error: 'The workshop is not accepting placements right now' }, { status: 409 })
  }

  const parsed = PostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  // Registers the caller on first placement, then blocks edits once they're done.
  const participant = await getOrCreateParticipant(id, {
    userId: user.userId,
    displayName: displayName(user),
    role: user.role === 'admin' ? 'admin' : 'collaborator',
  })
  if (participant.status === 'done') {
    return NextResponse.json({ error: 'You have already finished. Ask the facilitator to reopen.' }, { status: 409 })
  }

  const themes = await getThemes(id)
  if (!themes.some((t) => t.id === parsed.data.themeId)) {
    return NextResponse.json({ error: 'Unknown theme' }, { status: 400 })
  }

  await upsertPlacement(
    id,
    user.userId,
    parsed.data.themeId,
    (parsed.data.quadrantKey ?? null) as QuadrantKey | null
  )
  return NextResponse.json({ ok: true })
})
