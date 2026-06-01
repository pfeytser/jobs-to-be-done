import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getSessionById, saveStatements } from '@/lib/db/two-truths'
import { z } from 'zod'

const SaveSchema = z.object({
  statements: z
    .array(
      z.object({
        text: z.string().max(500),
        is_lie: z.boolean(),
      })
    )
    .length(3),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const gameSession = await getSessionById(id)
    if (!gameSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only the assigned author may edit, and only while still in draft.
    if (gameSession.author_id !== session.user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (gameSession.status !== 'draft') {
      return NextResponse.json({ error: 'This session is locked and can no longer be edited.' }, { status: 409 })
    }

    const parsed = SaveSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    // Exactly one statement may be flagged as the lie.
    const lies = parsed.data.statements.filter((s) => s.is_lie).length
    if (lies !== 1) {
      return NextResponse.json({ error: 'Mark exactly one statement as the lie.' }, { status: 400 })
    }

    await saveStatements(id, parsed.data.statements)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[two-truths/sessions/:id/statements PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
