import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireAdmin, route } from '@/lib/auth/guards'
import { getQAProjectById, updateQAProject, deleteQAProject } from '@/lib/db/qa-projects'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  platform: z.enum(['Web', 'Mobile App']).optional(),
  viewports: z.array(z.string()).optional(),
  operating_systems: z.array(z.string()).optional(),
  browsers: z.array(z.string()).optional(),
  user_types: z.array(z.string()).optional(),
  user_type_instructions: z.record(z.string(), z.string()).optional(),
  _merge_instructions: z.record(z.string(), z.string()).optional(),
  status: z.enum(['draft', 'active', 'complete', 'archived']).optional(),
})

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id } = await params
  const project = await getQAProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'admin' && project.status !== 'active') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ project })
})

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  const { _merge_instructions, ...rest } = parsed.data
  let updateData: typeof rest & { user_type_instructions?: Record<string, string> } = rest
  if (_merge_instructions) {
    const existing = await getQAProjectById(id)
    if (existing) {
      updateData = { ...rest, user_type_instructions: { ...existing.user_type_instructions, ..._merge_instructions } }
    }
  }
  const project = await updateQAProject(id, updateData)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ project })
})

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()

  const { id } = await params
  await deleteQAProject(id)
  return NextResponse.json({ ok: true })
})
