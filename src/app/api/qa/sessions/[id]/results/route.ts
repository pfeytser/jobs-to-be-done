import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getSessionById, touchSession } from '@/lib/db/qa-sessions'
import { upsertResult, saveTesterUsername } from '@/lib/db/qa-results'
import { z } from 'zod'

const ResultSchema = z.object({
  test_item_id: z.string().min(1),
  status: z.enum(['pass', 'fail', 'blocked', 'skipped', 'not_tested']),
  steps_taken: z.string().nullable().optional(),
  expected_behavior: z.string().nullable().optional(),
  actual_behavior: z.string().nullable().optional(),
  blocked_note: z.string().nullable().optional(),
  test_username: z.string().nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  try {
    const qaSession = await getSessionById(sessionId)
    if (!qaSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.user.role !== 'admin' && qaSession.tester_id !== session.user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = ResultSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { test_item_id, status, steps_taken, expected_behavior, actual_behavior, blocked_note, test_username } = parsed.data
    const result = await upsertResult({
      session_id: sessionId,
      project_id: qaSession.project_id,
      test_item_id,
      tester_id: qaSession.tester_id,
      status,
      steps_taken,
      expected_behavior,
      actual_behavior,
      blocked_note,
      test_username,
    })

    // Save test username to history if provided
    if (parsed.data.test_username && parsed.data.test_username !== 'Not signed in') {
      await saveTesterUsername(qaSession.tester_id, qaSession.project_id, parsed.data.test_username)
    }

    await touchSession(sessionId)
    return NextResponse.json({ result })
  } catch (error) {
    console.error('[qa/results POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
