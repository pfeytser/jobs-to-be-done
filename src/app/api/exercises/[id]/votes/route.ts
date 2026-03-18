import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import {
  getVoteTotalsForExercise,
  getUserVoteCount,
  getUserVoteBreakdown,
  getPerUserVoteSpend,
  submitVote,
  MAX_VOTES_PER_USER,
} from '@/lib/db/votes'
import { getExerciseById } from '@/lib/db/exercises'
import { z } from 'zod'

const VoteSchema = z.object({
  entryId: z.string().min(1),
  action: z.enum(['add', 'remove']),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: exerciseId } = await params

  try {
    const exercise = await getExerciseById(exerciseId)
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    const isAdmin = session.user.role === 'admin'
    const userId = session.user.userId

    const [totals, usedVotes, breakdown] = await Promise.all([
      getVoteTotalsForExercise(exerciseId),
      getUserVoteCount(exerciseId, userId),
      getUserVoteBreakdown(exerciseId, userId),
    ])

    const response: Record<string, unknown> = {
      totals,
      usedVotes,
      remainingVotes: MAX_VOTES_PER_USER - usedVotes,
      maxVotes: MAX_VOTES_PER_USER,
      breakdown,
    }

    if (isAdmin) {
      const perUserSpend = await getPerUserVoteSpend(exerciseId)
      response.perUserSpend = perUserSpend.map((spend) => ({
        userId: spend.userId,
        used: spend.used,
        remaining: MAX_VOTES_PER_USER - spend.used,
      }))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[votes GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: exerciseId } = await params

  try {
    const exercise = await getExerciseById(exerciseId)
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    if (!exercise.isActive) {
      return NextResponse.json({ error: 'Exercise is not active' }, { status: 400 })
    }

    if (exercise.currentPhase !== 2) {
      return NextResponse.json(
        { error: 'Voting is only allowed in phase 2' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const parsed = VoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const result = await submitVote({
      exerciseId,
      entryId: parsed.data.entryId,
      userId: session.user.userId,
      action: parsed.data.action,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      usedVotes: result.usedVotes,
      remainingVotes: MAX_VOTES_PER_USER - result.usedVotes,
    })
  } catch (error) {
    console.error('[votes POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
