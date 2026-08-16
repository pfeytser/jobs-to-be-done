import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireAdmin, route } from '@/lib/auth/guards'
import {
  getExerciseById,
  setActiveExercise,
  updateExercisePhase,
  updateExerciseTimer,
  updateExercisePrompt,
  deactivateExercise,
  archiveExercise,
  unarchiveExercise,
  updateExerciseAnalysis,
  type SentimentAnalysisResult,
} from '@/lib/db/exercises'
import { z } from 'zod'

const UpdateExerciseSchema = z.object({
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  currentPhase: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  timerEndsAt: z.string().nullable().optional(),
  mainPrompt: z.string().max(500).nullable().optional(),
  sentimentAnalysis: z.unknown().optional(),
})

export const GET = route(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireUser()

  const { id } = await params

  const exercise = await getExerciseById(id)
  if (!exercise) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ exercise })
})

export const PATCH = route(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAdmin()

  const { id } = await params

  const body = await req.json()
  const parsed = UpdateExerciseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { isActive, isArchived, currentPhase, timerEndsAt, mainPrompt, sentimentAnalysis } = parsed.data

  if (isActive === true) {
    await setActiveExercise(id)
  } else if (isActive === false) {
    await deactivateExercise(id)
  }

  if (isArchived === true) {
    await archiveExercise(id)
  } else if (isArchived === false) {
    await unarchiveExercise(id)
  }

  if (currentPhase !== undefined) {
    await updateExercisePhase(id, currentPhase as 1 | 2 | 3 | 4 | 5)
  }

  if (timerEndsAt !== undefined) {
    await updateExerciseTimer(id, timerEndsAt)
  }

  if (mainPrompt !== undefined) {
    await updateExercisePrompt(id, mainPrompt)
  }

  if (sentimentAnalysis !== undefined) {
    await updateExerciseAnalysis(id, sentimentAnalysis as SentimentAnalysisResult)
  }

  const updated = await getExerciseById(id)
  return NextResponse.json({ exercise: updated })
})
