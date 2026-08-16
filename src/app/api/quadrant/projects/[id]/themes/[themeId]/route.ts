import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getProjectById,
  getThemes,
  updateTheme,
  deleteTheme,
  QUADRANT_KEYS,
  type QuadrantKey,
} from '@/lib/db/quadrants'
import { z } from 'zod'

const QuadrantKeySchema = z.enum(QUADRANT_KEYS as unknown as [string, ...string[]])

const UpdateSchema = z.object({
  title: z.string().min(1).max(300),
  items: z.array(z.string().max(300)).max(60).optional().default([]),
  facilitatorReference: QuadrantKeySchema.nullable().optional().default(null),
})

function canManage(user: { role: string; userId: string }, createdBy: string): boolean {
  return user.role === 'admin' || createdBy === user.userId
}

export const PATCH = route(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; themeId: string }> }) => {
    const user = await requireUser()
    const { id, themeId } = await params
    const project = await getProjectById(id)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canManage(user, project.created_by)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (project.status !== 'setup') {
      return NextResponse.json({ error: 'Themes can only be edited during setup' }, { status: 409 })
    }
    if (!(await getThemes(id)).some((t) => t.id === themeId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const parsed = UpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }
    await updateTheme(id, themeId, {
      title: parsed.data.title,
      items: parsed.data.items,
      facilitatorReference: (parsed.data.facilitatorReference ?? null) as QuadrantKey | null,
    })
    return NextResponse.json({ ok: true })
  }
)

export const DELETE = route(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string; themeId: string }> }) => {
    const user = await requireUser()
    const { id, themeId } = await params
    const project = await getProjectById(id)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canManage(user, project.created_by)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (project.status !== 'setup') {
      return NextResponse.json({ error: 'Themes can only be deleted during setup' }, { status: 409 })
    }
    await deleteTheme(id, themeId)
    return NextResponse.json({ ok: true })
  }
)
