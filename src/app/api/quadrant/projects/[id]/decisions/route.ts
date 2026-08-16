import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getProjectById, freezeAndSeedDecisions } from '@/lib/db/quadrants'
import { z } from 'zod'

const PostSchema = z.object({ action: z.literal('freeze') })

function canManage(user: { role: string; userId: string }, createdBy: string): boolean {
  return user.role === 'admin' || createdBy === user.userId
}

/**
 * Freezes the reveal in amber and seeds the decided board from the group
 * consensus. Facilitator-only, and only from `reveal`. Idempotent in the domain
 * layer, so a double-submit can't retake the snapshot or reset the board.
 */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params

  const parsed = PostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, project.created_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (project.status !== 'reveal') {
    return NextResponse.json({ error: 'Reveal the results before starting decisions' }, { status: 409 })
  }

  const { alreadyFrozen } = await freezeAndSeedDecisions(id, {
    userId: user.userId,
    displayName: (user.name ?? user.email ?? 'Facilitator').slice(0, 120),
  })
  return NextResponse.json({ ok: true, alreadyFrozen })
})
