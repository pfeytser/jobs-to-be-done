import { turso } from './client'
import { runMigrations } from './migrations'

export interface SentimentClusterSolution {
  id: string
  exerciseId: string
  clusterLabel: string
  userId: string
  userName?: string | null
  text: string
  createdAt: string
}

function rowToSolution(row: Record<string, unknown>): SentimentClusterSolution {
  return {
    id: row.id as string,
    exerciseId: row.exerciseId as string,
    clusterLabel: row.clusterLabel as string,
    userId: row.userId as string,
    userName: row.userName as string | null,
    text: row.text as string,
    createdAt: row.createdAt as string,
  }
}

export async function getSentimentSolutionsByExercise(exerciseId: string): Promise<SentimentClusterSolution[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM sentiment_cluster_solutions WHERE exerciseId = ? ORDER BY createdAt ASC',
    args: [exerciseId],
  })
  return result.rows.map((r) => rowToSolution(r as Record<string, unknown>))
}

export async function createSentimentSolution(data: {
  exerciseId: string
  clusterLabel: string
  userId: string
  userName?: string | null
  text: string
}): Promise<SentimentClusterSolution> {
  await runMigrations()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await turso.execute({
    sql: 'INSERT INTO sentiment_cluster_solutions (id, exerciseId, clusterLabel, userId, userName, text, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, data.exerciseId, data.clusterLabel, data.userId, data.userName ?? null, data.text, createdAt],
  })
  return {
    id,
    exerciseId: data.exerciseId,
    clusterLabel: data.clusterLabel,
    userId: data.userId,
    userName: data.userName ?? null,
    text: data.text,
    createdAt,
  }
}
