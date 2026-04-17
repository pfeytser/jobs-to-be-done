import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
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

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    if (session.user.role === 'admin') {
      const projects = await getAllQAProjects()
      return NextResponse.json({ projects })
    } else {
      const projects = await getActiveQAProjects()
      return NextResponse.json({ projects })
    }
  } catch (error) {
    console.error('[qa/projects GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const id = `qp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const project = await createQAProject({ ...parsed.data, id, created_by: session.user.userId })
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('[qa/projects POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
