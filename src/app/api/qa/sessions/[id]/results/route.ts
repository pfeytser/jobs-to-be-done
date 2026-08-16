import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getSessionById, touchSession } from '@/lib/db/qa-sessions'
import { upsertResult, saveTesterUsername } from '@/lib/db/qa-results'
import { z } from 'zod'

// A screenshot_url must point at our own Vercel Blob store — never an arbitrary
// host. The export route later fetches this URL server-side, so an unconstrained
// value would be a stored SSRF vector.
function isBlobUrl(u: string): boolean {
  try {
    const host = new URL(u).hostname
    return host === 'blob.vercel-storage.com' || host.endsWith('.blob.vercel-storage.com')
  } catch {
    return false
  }
}

// Strip any path components so the value can never traverse when written into
// the export ZIP (Zip Slip).
function safeBasename(name: string): string {
  return name.replace(/^.*[\\/]/, '').replace(/[^\w.\-]+/g, '_').slice(0, 200)
}

const ResultSchema = z.object({
  test_item_id: z.string().min(1),
  status: z.enum(['pass', 'fail', 'blocked', 'skipped', 'not_tested']),
  steps_taken: z.string().nullable().optional(),
  expected_behavior: z.string().nullable().optional(),
  actual_behavior: z.string().nullable().optional(),
  blocked_note: z.string().nullable().optional(),
  test_username: z.string().nullable().optional(),
  screenshot_filename: z.string().max(255).nullable().optional(),
  screenshot_url: z
    .string()
    .url()
    .refine(isBlobUrl, { message: 'screenshot_url must be a Vercel Blob URL' })
    .nullable()
    .optional(),
})

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id: sessionId } = await params
  const qaSession = await getSessionById(sessionId)
  if (!qaSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'admin' && qaSession.tester_id !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = ResultSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const { test_item_id, status, steps_taken, expected_behavior, actual_behavior, blocked_note, test_username, screenshot_filename, screenshot_url } = parsed.data
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
    screenshot_filename: screenshot_filename ? safeBasename(screenshot_filename) : screenshot_filename,
    screenshot_url,
  })

  // Save test username to history if provided
  if (parsed.data.test_username && parsed.data.test_username !== 'Not signed in') {
    await saveTesterUsername(qaSession.tester_id, qaSession.project_id, parsed.data.test_username)
  }

  await touchSession(sessionId)
  return NextResponse.json({ result })
})
