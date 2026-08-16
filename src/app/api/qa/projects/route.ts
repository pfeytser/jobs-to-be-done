import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireAdmin, route } from '@/lib/auth/guards'
import { getAllQAProjects, getActiveQAProjects, createQAProject } from '@/lib/db/qa-projects'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  platform: z.enum(['Web', 'Mobile App']).default('Web'),
  viewports: z.array(z.string()).default([]),
  operating_systems: z.array(z.string()).default([]),
  browsers: z.array(z.string()).default([]),
  user_types: z.array(z.string()).default([]),
})

export const GET = route(async () => {
  const user = await requireUser()

  if (user.role === 'admin') {
    const projects = await getAllQAProjects()
    return NextResponse.json({ projects })
  } else {
    const projects = await getActiveQAProjects()
    return NextResponse.json({ projects })
  }
})

export const POST = route(async (req: NextRequest) => {
  const user = await requireAdmin()

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const id = `qp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const project = await createQAProject({ ...parsed.data, id, created_by: user.userId })
  return NextResponse.json({ project }, { status: 201 })
})
