import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getSessionById, completeSession } from '@/lib/db/qa-sessions'
import { getResultsBySession } from '@/lib/db/qa-results'
import { getTestItemsByProject } from '@/lib/db/qa-test-items'

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id: sessionId } = await params
  const qaSession = await getSessionById(sessionId)
  if (!qaSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Non-admins can only see their own sessions
  if (user.role !== 'admin' && qaSession.tester_id !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [items, results] = await Promise.all([
    getTestItemsByProject(qaSession.project_id),
    getResultsBySession(sessionId),
  ])

  return NextResponse.json({ session: qaSession, items, results })
})

export const PATCH = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id: sessionId } = await params
  const qaSession = await getSessionById(sessionId)
  if (!qaSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (user.role !== 'admin' && qaSession.tester_id !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await completeSession(sessionId)
  return NextResponse.json({ ok: true })
})
