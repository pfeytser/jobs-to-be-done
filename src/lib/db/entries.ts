import { turso } from './client'
import { runMigrations } from './migrations'

export interface JTBDEntry {
  id: string
  exerciseId: string
  userId: string
  userEmail: string
  userName?: string | null
  situation: string
  motivation: string
  expectedOutcome: string
  fullSentence: string
  createdAt: string
}

function rowToEntry(row: Record<string, unknown>): JTBDEntry {
  return {
    id: row.id as string,
    exerciseId: row.exerciseId as string,
    userId: row.userId as string,
    userEmail: row.userEmail as string,
    userName: row.userName as string | null,
    situation: row.situation as string,
    motivation: row.motivation as string,
    expectedOutcome: row.expectedOutcome as string,
    fullSentence: row.fullSentence as string,
    createdAt: row.createdAt as string,
  }
}

export async function getEntriesByExercise(
  exerciseId: string
): Promise<JTBDEntry[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM jtbd_entries WHERE exerciseId = ? ORDER BY createdAt ASC',
    args: [exerciseId],
  })
  return result.rows.map((r) => rowToEntry(r as Record<string, unknown>))
}

export async function getEntriesByUser(
  exerciseId: string,
  userId: string
): Promise<JTBDEntry[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM jtbd_entries WHERE exerciseId = ? AND userId = ? ORDER BY createdAt ASC',
    args: [exerciseId, userId],
  })
  return result.rows.map((r) => rowToEntry(r as Record<string, unknown>))
}

export async function createEntry(data: {
  exerciseId: string
  userId: string
  userEmail: string
  userName?: string
  situation: string
  motivation: string
  expectedOutcome: string
}): Promise<JTBDEntry> {
  await runMigrations()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const fullSentence = `When ${data.situation}, I want to ${data.motivation}, so I can ${data.expectedOutcome}.`

  await turso.execute({
    sql: `INSERT INTO jtbd_entries
      (id, exerciseId, userId, userEmail, userName, situation, motivation, expectedOutcome, fullSentence, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.exerciseId,
      data.userId,
      data.userEmail,
      data.userName ?? null,
      data.situation,
      data.motivation,
      data.expectedOutcome,
      fullSentence,
      createdAt,
    ],
  })

  return {
    id,
    exerciseId: data.exerciseId,
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName ?? null,
    situation: data.situation,
    motivation: data.motivation,
    expectedOutcome: data.expectedOutcome,
    fullSentence,
    createdAt,
  }
}

export async function deleteEntry(
  id: string,
  userId: string
): Promise<boolean> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'DELETE FROM jtbd_entries WHERE id = ? AND userId = ?',
    args: [id, userId],
  })
  return (result.rowsAffected ?? 0) > 0
}

export async function deleteEntryAdmin(id: string): Promise<boolean> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'DELETE FROM jtbd_entries WHERE id = ?',
    args: [id],
  })
  return (result.rowsAffected ?? 0) > 0
}
