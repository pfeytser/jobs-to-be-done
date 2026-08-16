import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getExerciseById } from '@/lib/db/exercises'
import { createSolution } from '@/lib/db/brainstorm'
import { z } from 'zod'

const CreateSolutionSchema = z.object({
  text: z.string().min(1).max(1000).transform((s) => s.trim()),
})

export const POST = route(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) => {
  const user = await requireUser()

  const { id: exerciseId, entryId } = await params

  try {
    const exercise = await getExerciseById(exerciseId)
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }
    if (exercise.currentPhase !== 4) {
      return NextResponse.json({ error: 'Brainstorming is only open in phase 4' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = CreateSolutionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const solution = await createSolution({
      exerciseId,
      entryId,
      userId: user.userId,
      userName: user.name ?? null,
      text: parsed.data.text,
    })

    return NextResponse.json({ solution }, { status: 201 })
  } catch (error) {
    console.error('[brainstorm solutions POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
