import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getExerciseById } from '@/lib/db/exercises'
import { getEntriesByExercise } from '@/lib/db/entries'
import { getProblemStatements, getSolutions } from '@/lib/db/brainstorm'

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

    const [allEntries, problemStatements, solutions] = await Promise.all([
      getEntriesByExercise(exerciseId),
      getProblemStatements(exerciseId),
      getSolutions(exerciseId),
    ])

    // If deduplication exists, only show cards for canonical entries
    const canonicalIds = exercise.jtbdDeduplication
      ? new Set(exercise.jtbdDeduplication.groups.map((g) => g.canonicalId))
      : null
    const entries = canonicalIds
      ? allEntries.filter((e) => canonicalIds.has(e.id))
      : allEntries

    const psMap = new Map(problemStatements.map((p) => [p.entryId, p.problemStatement]))
    const solutionsMap = new Map<string, typeof solutions>()
    for (const s of solutions) {
      if (!solutionsMap.has(s.entryId)) solutionsMap.set(s.entryId, [])
      solutionsMap.get(s.entryId)!.push(s)
    }

    const cards = entries.map((entry) => ({
      entryId: entry.id,
      fullSentence: entry.fullSentence,
      situation: entry.situation,
      motivation: entry.motivation,
      expectedOutcome: entry.expectedOutcome,
      problemStatement: psMap.get(entry.id) ?? null,
      solutions: (solutionsMap.get(entry.id) ?? []).map((s) => ({
        id: s.id,
        text: s.text,
        userName: s.userName,
        createdAt: s.createdAt,
      })),
    }))

    return NextResponse.json({ cards })
  } catch (error) {
    console.error('[brainstorm GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
