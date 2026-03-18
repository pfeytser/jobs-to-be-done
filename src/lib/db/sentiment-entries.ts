import { turso } from './client'
import { runMigrations } from './migrations'

export interface SentimentEntry {
  id: string
  exerciseId: string
  userId: string
  userEmail: string
  userName?: string | null
  term: string
  createdAt: string
}

function rowToEntry(row: Record<string, unknown>): SentimentEntry {
  return {
    id: row.id as string,
    exerciseId: row.exerciseId as string,
    userId: row.userId as string,
    userEmail: row.userEmail as string,
    userName: row.userName as string | null,
    term: row.term as string,
    createdAt: row.createdAt as string,
  }
}

export async function getSentimentEntries(exerciseId: string): Promise<SentimentEntry[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM sentiment_entries WHERE exerciseId = ? ORDER BY createdAt ASC',
    args: [exerciseId],
  })
  return result.rows.map((r) => rowToEntry(r as Record<string, unknown>))
}

export async function createSentimentEntry(data: {
  exerciseId: string
  userId: string
  userEmail: string
  userName?: string
  term: string
}): Promise<SentimentEntry> {
  await runMigrations()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await turso.execute({
    sql: 'INSERT INTO sentiment_entries (id, exerciseId, userId, userEmail, userName, term, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, data.exerciseId, data.userId, data.userEmail, data.userName ?? null, data.term, createdAt],
  })
  return {
    id,
    exerciseId: data.exerciseId,
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName ?? null,
    term: data.term,
    createdAt,
  }
}

export async function deleteSentimentEntry(id: string, userId: string): Promise<boolean> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'DELETE FROM sentiment_entries WHERE id = ? AND userId = ?',
    args: [id, userId],
  })
  return (result.rowsAffected ?? 0) > 0
}

export async function deleteSentimentEntryAdmin(id: string): Promise<boolean> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'DELETE FROM sentiment_entries WHERE id = ?',
    args: [id],
  })
  return (result.rowsAffected ?? 0) > 0
}
