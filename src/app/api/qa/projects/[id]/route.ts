import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const project = await getQAProjectById(id)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.user.role !== 'admin' && project.status !== 'active') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ project })
  } catch (error) {
    console.error('[qa/projects/:id GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  try {
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
  } catch (error) {
    console.error('[qa/projects/:id PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  try {
    await deleteQAProject(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[qa/projects/:id DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
