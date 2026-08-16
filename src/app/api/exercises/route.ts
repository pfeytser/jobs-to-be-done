import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { getAllExercises, createExercise } from '@/lib/db/exercises'
import { z } from 'zod'

const CreateExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  mainPrompt: z.string().max(500).nullable().optional(),
  type: z.enum(['jtbd', 'sentiment']).optional().default('jtbd'),
  jtbdMode: z.enum(['classic', 'hiring']).optional().default('classic'),
})

export const GET = route(async () => {
  await requireAdmin()

  const exercises = await getAllExercises()
  return NextResponse.json({ exercises })
})

export const POST = route(async (req: NextRequest) => {
  await requireAdmin()

  const body = await req.json()
  const parsed = CreateExerciseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const exercise = await createExercise(parsed.data.name, parsed.data.mainPrompt, parsed.data.type, parsed.data.jtbdMode)
  return NextResponse.json({ exercise }, { status: 201 })
})
