import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import {
  getSessionById,
  activateSession,
  revealSession,
  archiveSession,
  deleteSession,
  getStatements,
  getVoteForUser,
} from '@/lib/db/two-truths'
import { z } from 'zod'

const PatchSchema = z.object({
  action: z.enum(['activate', 'reveal', 'archive']),
})

/**
 * Poll-safe status endpoint. Returns just enough for the client to know when to
 * refresh the server-rendered view — never leaks the lie or vote tallies.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const gameSession = await getSessionById(id)
    if (!gameSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Non-admins can't poll drafts or archived sessions.
    if (session.user.role !== 'admin' && !['active', 'completed'].includes(gameSession.status)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const vote = await getVoteForUser(id, session.user.userId)
    return NextResponse.json({
      id: gameSession.id,
      status: gameSession.status,
      hasVoted: !!vote,
    })
  } catch (error) {
    console.error('[two-truths/sessions/:id GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params
    const parsed = PatchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const gameSession = await getSessionById(id)
    if (!gameSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { action } = parsed.data

    if (action === 'activate') {
      if (gameSession.status !== 'draft') {
        return NextResponse.json({ error: 'Only draft sessions can be activated' }, { status: 409 })
      }
      // Guard: every statement must have text and exactly one lie must be marked.
      const statements = await getStatements(id)
      const lies = statements.filter((s) => s.is_lie).length
      const blanks = statements.filter((s) => !s.text.trim()).length
      if (statements.length !== 3 || blanks > 0 || lies !== 1) {
        return NextResponse.json(
          { error: 'The author must fill in all three statements and mark exactly one lie before activation.' },
          { status: 409 }
        )
      }
      const updated = await activateSession(id)
      return NextResponse.json({ session: updated })
    }

    if (action === 'reveal') {
      if (gameSession.status !== 'active') {
        return NextResponse.json({ error: 'Only active sessions can be revealed' }, { status: 409 })
      }
      const updated = await revealSession(id)
      return NextResponse.json({ session: updated })
    }

    // archive
    if (gameSession.status !== 'completed') {
      return NextResponse.json({ error: 'Only completed sessions can be archived' }, { status: 409 })
    }
    const updated = await archiveSession(id)
    return NextResponse.json({ session: updated })
  } catch (error) {
    console.error('[two-truths/sessions/:id PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params
    const gameSession = await getSessionById(id)
    if (!gameSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (gameSession.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft sessions can be deleted' }, { status: 409 })
    }
    await deleteSession(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[two-truths/sessions/:id DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
