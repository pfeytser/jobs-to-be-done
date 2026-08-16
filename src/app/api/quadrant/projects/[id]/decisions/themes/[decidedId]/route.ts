import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getProjectById,
  moveDecidedTheme,
  rescopeDecidedTheme,
  removeDecidedTheme,
  QUADRANT_KEYS,
  type QuadrantKey,
} from '@/lib/db/quadrants'
import { z } from 'zod'

const QuadrantKeySchema = z.enum(QUADRANT_KEYS as unknown as [string, ...string[]])

const PatchSchema = z.union([
  z.object({ action: z.literal('move'), quadrantKey: QuadrantKeySchema.nullable() }),
  z.object({
    action: z.literal('rescope'),
    title: z.string().min(1).max(300),
    items: z.array(z.string().min(1).max(300)).max(60).optional().default([]),
    note: z.string().max(1000).optional().default(''),
  }),
])

function canManage(user: { role: string; userId: string }, createdBy: string): boolean {
  return user.role === 'admin' || createdBy === user.userId
}

/** Moves or re-scopes a theme on the decided board. Facilitator-only, post-freeze. */
export const PATCH = route(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; decidedId: string }> }) => {
    const user = await requireUser()
    const { id, decidedId } = await params

    const parsed = PatchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const project = await getProjectById(id)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canManage(user, project.created_by)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!project.frozen_at) {
      return NextResponse.json({ error: 'Decisions have not been started' }, { status: 409 })
    }

    const actor = { userId: user.userId, displayName: (user.name ?? user.email ?? 'Facilitator').slice(0, 120) }

    // Both helpers look the theme up scoped to this project, so an id from another
    // project resolves to null rather than being mutated.
    const theme =
      parsed.data.action === 'move'
        ? await moveDecidedTheme(id, decidedId, parsed.data.quadrantKey as QuadrantKey | null, actor)
        : await rescopeDecidedTheme(
            id,
            decidedId,
            { title: parsed.data.title, items: parsed.data.items, note: parsed.data.note },
            actor
          )

    if (!theme) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ theme })
  }
)

/** Drops a theme from the decided board. The frozen vote result keeps it. */
export const DELETE = route(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string; decidedId: string }> }) => {
    const user = await requireUser()
    const { id, decidedId } = await params

    const project = await getProjectById(id)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canManage(user, project.created_by)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!project.frozen_at) {
      return NextResponse.json({ error: 'Decisions have not been started' }, { status: 409 })
    }

    if (!(await removeDecidedTheme(id, decidedId, {
      userId: user.userId,
      displayName: (user.name ?? user.email ?? 'Facilitator').slice(0, 120),
    }))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  }
)
