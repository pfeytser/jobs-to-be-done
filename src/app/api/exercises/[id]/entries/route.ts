import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getEntriesByExercise, getEntriesByUser, createEntry } from '@/lib/db/entries'
import { getExerciseById } from '@/lib/db/exercises'
import { z } from 'zod'

const CreateClassicEntrySchema = z.object({
  situation: z.string().min(1).max(500),
  motivation: z.string().min(1).max(500),
  expectedOutcome: z.string().min(1).max(500),
})

const CreateHiringEntrySchema = z.object({
  hiringText: z.string().min(1).max(500).transform((s) => s.trim()),
})

export const GET = route(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireUser()

  const { id: exerciseId } = await params

  try {
    const exercise = await getExerciseById(exerciseId)
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    const isAdmin = user.role === 'admin'
    const userId = user.userId

    let entries
    if (isAdmin || exercise.currentPhase >= 2) {
      entries = await getEntriesByExercise(exerciseId)
    } else {
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
})

export const POST = route(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireUser()

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

    if (exercise.jtbdMode === 'hiring') {
      const parsed = CreateHiringEntrySchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parsed.error.issues },
          { status: 400 }
        )
      }
      const { hiringText } = parsed.data
      const entry = await createEntry({
        exerciseId,
        userId: user.userId,
        userEmail: user.email!,
        userName: user.name ?? undefined,
        situation: hiringText,
        motivation: '',
        expectedOutcome: '',
        fullSentenceOverride: `I am hiring it to ${hiringText}`,
      })
      return NextResponse.json({ entry }, { status: 201 })
    }

    // Classic mode
    const parsed = CreateClassicEntrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const entry = await createEntry({
      exerciseId,
      userId: user.userId,
      userEmail: user.email!,
      userName: user.name ?? undefined,
      ...parsed.data,
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error('[entries POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
