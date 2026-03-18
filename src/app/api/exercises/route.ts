import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getAllExercises, createExercise } from '@/lib/db/exercises'
import { z } from 'zod'

const CreateExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  mainPrompt: z.string().max(500).nullable().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const exercises = await getAllExercises()
    return NextResponse.json({ exercises })
  } catch (error) {
    console.error('[exercises GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const parsed = CreateExerciseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const exercise = await createExercise(parsed.data.name, parsed.data.mainPrompt)
    return NextResponse.json({ exercise }, { status: 201 })
  } catch (error) {
    console.error('[exercises POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
