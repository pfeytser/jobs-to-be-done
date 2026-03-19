import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getExerciseById } from '@/lib/db/exercises'
import { getSentimentSolutionsByExercise } from '@/lib/db/sentiment-brainstorm'

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

    const clusters = exercise.sentimentAnalysis?.clusters ?? []
    const solutions = await getSentimentSolutionsByExercise(exerciseId)

    const solutionsByCluster = new Map<string, typeof solutions>()
    for (const s of solutions) {
      if (!solutionsByCluster.has(s.clusterLabel)) solutionsByCluster.set(s.clusterLabel, [])
      solutionsByCluster.get(s.clusterLabel)!.push(s)
    }

    const cards = clusters.map((cluster) => ({
      label: cluster.label,
      count: cluster.count,
      terms: cluster.terms,
      solutions: (solutionsByCluster.get(cluster.label) ?? []).map((s) => ({
        id: s.id,
        text: s.text,
        userName: s.userName,
        createdAt: s.createdAt,
      })),
    }))

    return NextResponse.json({ cards })
  } catch (error) {
    console.error('[sentiment-brainstorm GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
