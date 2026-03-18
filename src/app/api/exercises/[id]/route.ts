import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import {
  getExerciseById,
  setActiveExercise,
  updateExercisePhase,
  updateExerciseTimer,
  updateExercisePrompt,
  deactivateExercise,
} from '@/lib/db/exercises'
import { z } from 'zod'

const UpdateExerciseSchema = z.object({
  isActive: z.boolean().optional(),
  currentPhase: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  timerEndsAt: z.string().nullable().optional(),
  mainPrompt: z.string().max(500).nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const exercise = await getExerciseById(id)
    if (!exercise) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ exercise })
  } catch (error) {
    console.error('[exercise GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const parsed = UpdateExerciseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { isActive, currentPhase, timerEndsAt, mainPrompt } = parsed.data

    if (isActive === true) {
      await setActiveExercise(id)
    } else if (isActive === false) {
      await deactivateExercise(id)
    }

    if (currentPhase !== undefined) {
      await updateExercisePhase(id, currentPhase)
    }

    if (timerEndsAt !== undefined) {
      await updateExerciseTimer(id, timerEndsAt)
    }

    if (mainPrompt !== undefined) {
      await updateExercisePrompt(id, mainPrompt)
    }

    const updated = await getExerciseById(id)
    return NextResponse.json({ exercise: updated })
  } catch (error) {
    console.error('[exercise PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
