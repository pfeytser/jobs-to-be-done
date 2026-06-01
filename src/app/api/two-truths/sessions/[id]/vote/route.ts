import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getSessionById, getStatements, castVote } from '@/lib/db/two-truths'
import { z } from 'zod'

const VoteSchema = z.object({
  statementId: z.string().min(1),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const gameSession = await getSessionById(id)
    if (!gameSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (gameSession.status !== 'active') {
      return NextResponse.json({ error: 'Voting is closed for this session.' }, { status: 409 })
    }
    // Authors cannot vote in their own session.
    if (gameSession.author_id === session.user.userId) {
      return NextResponse.json({ error: 'Authors cannot vote in their own session.' }, { status: 403 })
    }

    const parsed = VoteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    // The chosen statement must belong to this session.
    const statements = await getStatements(id)
    if (!statements.some((s) => s.id === parsed.data.statementId)) {
      return NextResponse.json({ error: 'Invalid statement' }, { status: 400 })
    }

    const voteId = `ttv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const recorded = await castVote({
      id: voteId,
      session_id: id,
      statement_id: parsed.data.statementId,
      voter_id: session.user.userId,
      voter_name: session.user.name ?? session.user.email ?? 'Anonymous',
      voter_email: session.user.email ?? '',
    })

    if (!recorded) {
      return NextResponse.json({ error: 'You have already voted in this session.' }, { status: 409 })
    }
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('[two-truths/sessions/:id/vote POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
