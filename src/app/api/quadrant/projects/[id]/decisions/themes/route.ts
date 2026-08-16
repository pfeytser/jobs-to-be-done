import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getProjectById, addDecidedTheme, QUADRANT_KEYS, type QuadrantKey } from '@/lib/db/quadrants'
import { z } from 'zod'

const QuadrantKeySchema = z.enum(QUADRANT_KEYS as unknown as [string, ...string[]])

const CreateSchema = z.object({
  title: z.string().min(1).max(300),
  items: z.array(z.string().min(1).max(300)).max(60).optional().default([]),
  quadrantKey: QuadrantKeySchema.nullable().optional().default(null),
  /** Records that this theme's scope was carved out of an existing decided theme. */
  derivedFromId: z.string().max(120).nullable().optional().default(null),
  note: z.string().max(1000).optional().default(''),
})

function canManage(user: { role: string; userId: string }, createdBy: string): boolean {
  return user.role === 'admin' || createdBy === user.userId
}

/** Adds a theme that came out of the discussion. Facilitator-only, post-freeze. */
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params

  const parsed = CreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, project.created_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!project.frozen_at) {
    return NextResponse.json({ error: 'Start decisions before adding themes' }, { status: 409 })
  }

  const theme = await addDecidedTheme(
    id,
    {
      title: parsed.data.title,
      items: parsed.data.items,
      quadrantKey: (parsed.data.quadrantKey ?? null) as QuadrantKey | null,
      derivedFromId: parsed.data.derivedFromId,
      note: parsed.data.note,
    },
    { userId: user.userId, displayName: (user.name ?? user.email ?? 'Facilitator').slice(0, 120) }
  )
  return NextResponse.json({ theme })
})
