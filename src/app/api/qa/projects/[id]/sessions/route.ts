import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { createSession, getSessionsWithProgress, getTesterSessionsWithProgress } from '@/lib/db/qa-sessions'
import { z } from 'zod'

const CreateSessionSchema = z.object({
  user_type: z.string().min(1),
  viewport: z.string().min(1),
  operating_system: z.string().min(1),
  browser: z.string().default(''),
})

export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id: projectId } = await params
  if (user.role === 'admin') {
    const sessions = await getSessionsWithProgress(projectId)
    return NextResponse.json({ sessions })
  } else {
    const sessions = await getTesterSessionsWithProgress(user.userId, projectId)
    return NextResponse.json({ sessions })
  }
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id: projectId } = await params
  const body = await req.json()
  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const id = `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const qaSession = await createSession({
    id,
    project_id: projectId,
    tester_id: user.userId,
    tester_name: user.name ?? user.email ?? 'Tester',
    tester_email: user.email ?? '',
    ...parsed.data,
  })
  return NextResponse.json({ session: qaSession }, { status: 201 })
})
