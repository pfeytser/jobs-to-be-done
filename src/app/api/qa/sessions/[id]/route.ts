import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getSessionById, completeSession } from '@/lib/db/qa-sessions'
import { getResultsBySession } from '@/lib/db/qa-results'
import { getTestItemsByProject } from '@/lib/db/qa-test-items'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  try {
    const qaSession = await getSessionById(sessionId)
    if (!qaSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Non-admins can only see their own sessions
    if (session.user.role !== 'admin' && qaSession.tester_id !== session.user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [items, results] = await Promise.all([
      getTestItemsByProject(qaSession.project_id),
      getResultsBySession(sessionId),
    ])

    return NextResponse.json({ session: qaSession, items, results })
  } catch (error) {
    console.error('[qa/sessions/:id GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  try {
    const qaSession = await getSessionById(sessionId)
    if (!qaSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (session.user.role !== 'admin' && qaSession.tester_id !== session.user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await completeSession(sessionId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[qa/sessions/:id PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
