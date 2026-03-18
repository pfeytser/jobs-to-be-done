import { turso } from './client'
import { runMigrations } from './migrations'

export interface Exercise {
  id: string
  name: string
  mainPrompt?: string | null
  isActive: boolean
  currentPhase: 1 | 2 | 3
  timerEndsAt?: string | null
  createdAt: string
}

function rowToExercise(row: Record<string, unknown>): Exercise {
  return {
    id: row.id as string,
    name: row.name as string,
    mainPrompt: row.mainPrompt as string | null,
    isActive: row.isActive === 1 || row.isActive === true,
    currentPhase: (row.currentPhase as 1 | 2 | 3) ?? 1,
    timerEndsAt: row.timerEndsAt as string | null,
    createdAt: row.createdAt as string,
  }
}

export async function getActiveExercise(): Promise<Exercise | null> {
  await runMigrations()
  const result = await turso.execute(
    'SELECT * FROM exercises WHERE isActive = 1 LIMIT 1'
  )
  if (result.rows.length === 0) return null
  return rowToExercise(result.rows[0] as Record<string, unknown>)
}

export async function getAllExercises(): Promise<Exercise[]> {
  await runMigrations()
  const result = await turso.execute(
    'SELECT * FROM exercises ORDER BY createdAt DESC'
  )
  return result.rows.map((r) => rowToExercise(r as Record<string, unknown>))
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM exercises WHERE id = ?',
    args: [id],
  })
  if (result.rows.length === 0) return null
  return rowToExercise(result.rows[0] as Record<string, unknown>)
}

export async function createExercise(name: string, mainPrompt?: string | null): Promise<Exercise> {
  await runMigrations()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await turso.execute({
    sql: 'INSERT INTO exercises (id, name, mainPrompt, isActive, currentPhase, createdAt) VALUES (?, ?, ?, 0, 1, ?)',
    args: [id, name, mainPrompt ?? null, createdAt],
  })
  return { id, name, mainPrompt, isActive: false, currentPhase: 1, createdAt }
}

export async function updateExercisePrompt(
  id: string,
  mainPrompt: string | null
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET mainPrompt = ? WHERE id = ?',
    args: [mainPrompt, id],
  })
}

export async function setActiveExercise(id: string): Promise<void> {
  await runMigrations()
  await turso.executeMultiple(
    `UPDATE exercises SET isActive = 0;
     UPDATE exercises SET isActive = 1 WHERE id = '${id}';`
  )
}

export async function updateExercisePhase(
  id: string,
  phase: 1 | 2 | 3
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET currentPhase = ? WHERE id = ?',
    args: [phase, id],
  })
}

export async function updateExerciseTimer(
  id: string,
  timerEndsAt: string | null
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET timerEndsAt = ? WHERE id = ?',
    args: [timerEndsAt, id],
  })
}

export async function deactivateExercise(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE exercises SET isActive = 0 WHERE id = ?',
    args: [id],
  })
}
