import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getEntriesByExercise, getEntriesByUser, createEntry } from '@/lib/db/entries'
import { getExerciseById } from '@/lib/db/exercises'
import { z } from 'zod'

const CreateEntrySchema = z.object({
  situation: z.string().min(1).max(500),
  motivation: z.string().min(1).max(500),
  expectedOutcome: z.string().min(1).max(500),
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

    const isAdmin = session.user.role === 'admin'
    const userId = session.user.userId

    let entries
    if (isAdmin || exercise.currentPhase >= 2) {
      // Admin always sees all; collaborators see all in phase 2+
      entries = await getEntriesByExercise(exerciseId)
    } else {
      // Phase 1: user sees only their own entries
      entries = await getEntriesByUser(exerciseId, userId)
    }

    // Anonymize in phase 2+ for non-admins
    if (!isAdmin && exercise.currentPhase >= 2) {
      entries = entries.map(({ userEmail: _e, userName: _n, userId: _u, ...entry }) => ({
        ...entry,
        userEmail: '',
        userName: null,
        userId: '',
      }))
    }

    return NextResponse.json({ entries, phase: exercise.currentPhase })
  } catch (error) {
    console.error('[entries GET]', error)
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

    if (exercise.currentPhase !== 1) {
      return NextResponse.json(
        { error: 'Entry submission is only allowed in phase 1' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const parsed = CreateEntrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const entry = await createEntry({
      exerciseId,
      userId: session.user.userId,
      userEmail: session.user.email!,
      userName: session.user.name ?? undefined,
      ...parsed.data,
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error('[entries POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
