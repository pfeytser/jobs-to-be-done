import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getProjectById,
  getThemes,
  getOrCreateParticipant,
  getPlacementsForUser,
  setParticipantStatus,
} from '@/lib/db/quadrants'

function displayName(user: { name?: string | null; email?: string | null }): string {
  return (user.name ?? user.email ?? 'Someone').slice(0, 120)
}

/** Marks the caller done — but only once every theme has been placed. */
export const POST = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.status !== 'active') {
    return NextResponse.json({ error: 'The workshop is not running' }, { status: 409 })
  }

  await getOrCreateParticipant(id, {
    userId: user.userId,
    displayName: displayName(user),
    role: user.role === 'admin' ? 'admin' : 'collaborator',
  })

  const themes = await getThemes(id)
  const placements = await getPlacementsForUser(id, user.userId)
  const placed = new Set(placements.filter((p) => p.quadrant_key).map((p) => p.theme_id))
  const allPlaced = themes.length > 0 && themes.every((t) => placed.has(t.id))
  if (!allPlaced) {
    return NextResponse.json({ error: 'Place every theme before finishing.' }, { status: 409 })
  }

  await setParticipantStatus(id, user.userId, 'done')
  return NextResponse.json({ ok: true })
})
