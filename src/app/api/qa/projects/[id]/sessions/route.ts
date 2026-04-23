import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { createSession, getSessionsWithProgress, getTesterSessionsWithProgress } from '@/lib/db/qa-sessions'
import { z } from 'zod'

const CreateSessionSchema = z.object({
  user_type: z.string().min(1),
  viewport: z.string().min(1),
  operating_system: z.string().min(1),
  browser: z.string().default(''),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  try {
    if (session.user.role === 'admin') {
      const sessions = await getSessionsWithProgress(projectId)
      return NextResponse.json({ sessions })
    } else {
      const sessions = await getTesterSessionsWithProgress(session.user.userId, projectId)
      return NextResponse.json({ sessions })
    }
  } catch (error) {
    console.error('[qa/sessions GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  try {
    const body = await req.json()
    const parsed = CreateSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const id = `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const qaSession = await createSession({
      id,
      project_id: projectId,
      tester_id: session.user.userId,
      tester_name: session.user.name ?? session.user.email ?? 'Tester',
      tester_email: session.user.email ?? '',
      ...parsed.data,
    })
    return NextResponse.json({ session: qaSession }, { status: 201 })
  } catch (error) {
    console.error('[qa/sessions POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
