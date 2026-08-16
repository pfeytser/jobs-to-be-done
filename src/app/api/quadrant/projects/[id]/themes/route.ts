import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getProjectById,
  getThemes,
  addTheme,
  importThemes,
  reorderThemes,
  QUADRANT_KEYS,
  TEMPLATE_THEMES,
  type QuadrantKey,
} from '@/lib/db/quadrants'
import { z } from 'zod'

const QuadrantKeySchema = z.enum(QUADRANT_KEYS as unknown as [string, ...string[]])

const ThemeInputSchema = z.object({
  title: z.string().min(1).max(300),
  items: z.array(z.string().max(300)).max(60).optional().default([]),
  facilitatorReference: QuadrantKeySchema.nullable().optional().default(null),
})

const PostSchema = z.union([
  z.object({ action: z.literal('add') }).merge(ThemeInputSchema),
  z.object({ action: z.literal('import-seed') }),
])

const PutSchema = z.object({ orderedIds: z.array(z.string().max(80)).max(500) })

function canManage(user: { role: string; userId: string }, createdBy: string): boolean {
  return user.role === 'admin' || createdBy === user.userId
}

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Themes carry the facilitator's private reference — never expose it here.
  const isAdmin = user.role === 'admin'
  if (!isAdmin && project.status === 'setup') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const themes = (await getThemes(id)).map((t) => ({
    id: t.id,
    title: t.title,
    items: t.items,
    sort_order: t.sort_order,
  }))
  return NextResponse.json({ themes })
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, project.created_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (project.status !== 'setup') {
    return NextResponse.json({ error: 'Themes can only be edited during setup' }, { status: 409 })
  }

  const parsed = PostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  if (parsed.data.action === 'import-seed') {
    await importThemes(
      id,
      TEMPLATE_THEMES.map((t) => ({ title: t.title, items: t.items, facilitatorReference: t.facilitatorReference }))
    )
    return NextResponse.json({ themes: await getThemes(id) }, { status: 201 })
  }

  const theme = await addTheme(id, {
    title: parsed.data.title,
    items: parsed.data.items,
    facilitatorReference: (parsed.data.facilitatorReference ?? null) as QuadrantKey | null,
  })
  return NextResponse.json({ theme }, { status: 201 })
})

export const PUT = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManage(user, project.created_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (project.status !== 'setup') {
    return NextResponse.json({ error: 'Themes can only be reordered during setup' }, { status: 409 })
  }

  const parsed = PutSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  await reorderThemes(id, parsed.data.orderedIds)
  return NextResponse.json({ themes: await getThemes(id) })
})
