import { turso } from './client'
import { runMigrations } from './migrations'

export interface BrainstormProblemStatement {
  id: string
  exerciseId: string
  entryId: string
  problemStatement: string
  createdAt: string
}

export interface BrainstormSolution {
  id: string
  exerciseId: string
  entryId: string
  userId: string
  userName?: string | null
  text: string
  createdAt: string
}

function rowToStatement(row: Record<string, unknown>): BrainstormProblemStatement {
  return {
    id: row.id as string,
    exerciseId: row.exerciseId as string,
    entryId: row.entryId as string,
    problemStatement: row.problemStatement as string,
    createdAt: row.createdAt as string,
  }
}

function rowToSolution(row: Record<string, unknown>): BrainstormSolution {
  return {
    id: row.id as string,
    exerciseId: row.exerciseId as string,
    entryId: row.entryId as string,
    userId: row.userId as string,
    userName: row.userName as string | null,
    text: row.text as string,
    createdAt: row.createdAt as string,
  }
}

export async function getProblemStatements(exerciseId: string): Promise<BrainstormProblemStatement[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM brainstorm_problem_statements WHERE exerciseId = ?',
    args: [exerciseId],
  })
  return result.rows.map((r) => rowToStatement(r as Record<string, unknown>))
}

export async function getProblemStatementByEntry(exerciseId: string, entryId: string): Promise<BrainstormProblemStatement | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM brainstorm_problem_statements WHERE exerciseId = ? AND entryId = ? LIMIT 1',
    args: [exerciseId, entryId],
  })
  if (result.rows.length === 0) return null
  return rowToStatement(result.rows[0] as Record<string, unknown>)
}

export async function upsertProblemStatement(data: {
  exerciseId: string
  entryId: string
  problemStatement: string
}): Promise<void> {
  await runMigrations()
  const existing = await getProblemStatementByEntry(data.exerciseId, data.entryId)
  if (existing) {
    await turso.execute({
      sql: 'UPDATE brainstorm_problem_statements SET problemStatement = ? WHERE exerciseId = ? AND entryId = ?',
      args: [data.problemStatement, data.exerciseId, data.entryId],
    })
  } else {
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    await turso.execute({
      sql: 'INSERT INTO brainstorm_problem_statements (id, exerciseId, entryId, problemStatement, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [id, data.exerciseId, data.entryId, data.problemStatement, createdAt],
    })
  }
}

export async function getSolutions(exerciseId: string): Promise<BrainstormSolution[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM brainstorm_solutions WHERE exerciseId = ? ORDER BY createdAt ASC',
    args: [exerciseId],
  })
  return result.rows.map((r) => rowToSolution(r as Record<string, unknown>))
}

export async function createSolution(data: {
  exerciseId: string
  entryId: string
  userId: string
  userName?: string | null
  text: string
}): Promise<BrainstormSolution> {
  await runMigrations()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await turso.execute({
    sql: 'INSERT INTO brainstorm_solutions (id, exerciseId, entryId, userId, userName, text, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, data.exerciseId, data.entryId, data.userId, data.userName ?? null, data.text, createdAt],
  })
  return { id, exerciseId: data.exerciseId, entryId: data.entryId, userId: data.userId, userName: data.userName ?? null, text: data.text, createdAt }
}
