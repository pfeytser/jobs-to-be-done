import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getSentimentEntries, createSentimentEntry } from '@/lib/db/sentiment-entries'
import { getExerciseById } from '@/lib/db/exercises'
import { z } from 'zod'

const CreateSentimentEntrySchema = z.object({
  term: z.string().min(1).max(200).transform((s) => s.trim()),
})

export async function GET(
  _req: NextRequest,
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

    const allEntries = await getSentimentEntries(exerciseId)
    const userId = session.user.userId
    const isAdmin = session.user.role === 'admin'

    // Phase 1: participants only see their own entries (no bias from others)
    // Admins always see all entries
    const visibleEntries = (isAdmin || exercise.currentPhase >= 2)
      ? allEntries
      : allEntries.filter((e) => e.userId === userId)

    const entries = visibleEntries.map((e) => ({
      id: e.id,
      term: e.term,
      createdAt: e.createdAt,
      isOwn: e.userId === userId,
    }))

    return NextResponse.json({ entries })
  } catch (error) {
    console.error('[sentiment-entries GET]', error)
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

    if (exercise.type !== 'sentiment') {
      return NextResponse.json({ error: 'Not a sentiment exercise' }, { status: 400 })
    }

    if (exercise.currentPhase !== 1) {
      return NextResponse.json(
        { error: 'Submissions are only allowed in phase 1' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const parsed = CreateSentimentEntrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const entry = await createSentimentEntry({
      exerciseId,
      userId: session.user.userId,
      userEmail: session.user.email!,
      userName: session.user.name ?? undefined,
      term: parsed.data.term,
    })

    return NextResponse.json({
      entry: {
        id: entry.id,
        term: entry.term,
        createdAt: entry.createdAt,
        isOwn: true,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[sentiment-entries POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
