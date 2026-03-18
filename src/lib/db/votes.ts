import { turso } from './client'
import { runMigrations } from './migrations'

export const MAX_VOTES_PER_USER = 20

export interface VoteTransaction {
  id: string
  exerciseId: string
  entryId: string
  userId: string
  action: 'add' | 'remove'
  timestamp: string
}

export interface VoteTotals {
  entryId: string
  total: number
}

export interface UserVoteSpend {
  userId: string
  userEmail: string
  used: number
}

function rowToTransaction(row: Record<string, unknown>): VoteTransaction {
  return {
    id: row.id as string,
    exerciseId: row.exerciseId as string,
    entryId: row.entryId as string,
    userId: row.userId as string,
    action: row.action as 'add' | 'remove',
    timestamp: row.timestamp as string,
  }
}

export async function getUserVoteCount(
  exerciseId: string,
  userId: string
): Promise<number> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT
      SUM(CASE WHEN action = 'add' THEN 1 ELSE -1 END) as net
      FROM vote_transactions
      WHERE exerciseId = ? AND userId = ?`,
    args: [exerciseId, userId],
  })
  const net = result.rows[0]?.net
  return typeof net === 'number' ? Math.max(0, net) : 0
}

export async function getEntryVoteCountForUser(
  entryId: string,
  userId: string
): Promise<number> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT
      SUM(CASE WHEN action = 'add' THEN 1 ELSE -1 END) as net
      FROM vote_transactions
      WHERE entryId = ? AND userId = ?`,
    args: [entryId, userId],
  })
  const net = result.rows[0]?.net
  return typeof net === 'number' ? Math.max(0, net) : 0
}

export async function getVoteTotalsForExercise(
  exerciseId: string
): Promise<VoteTotals[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT entryId,
      SUM(CASE WHEN action = 'add' THEN 1 ELSE -1 END) as total
      FROM vote_transactions
      WHERE exerciseId = ?
      GROUP BY entryId`,
    args: [exerciseId],
  })
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      entryId: row.entryId as string,
      total: Math.max(0, (row.total as number) ?? 0),
    }
  })
}

export async function getUserVoteBreakdown(
  exerciseId: string,
  userId: string
): Promise<Record<string, number>> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT entryId,
      SUM(CASE WHEN action = 'add' THEN 1 ELSE -1 END) as net
      FROM vote_transactions
      WHERE exerciseId = ? AND userId = ?
      GROUP BY entryId`,
    args: [exerciseId, userId],
  })
  const breakdown: Record<string, number> = {}
  for (const row of result.rows) {
    const r = row as Record<string, unknown>
    breakdown[r.entryId as string] = Math.max(0, (r.net as number) ?? 0)
  }
  return breakdown
}

export async function submitVote(data: {
  exerciseId: string
  entryId: string
  userId: string
  action: 'add' | 'remove'
}): Promise<{ success: boolean; error?: string; usedVotes: number }> {
  await runMigrations()

  const usedVotes = await getUserVoteCount(data.exerciseId, data.userId)

  if (data.action === 'add' && usedVotes >= MAX_VOTES_PER_USER) {
    return {
      success: false,
      error: `You have used all ${MAX_VOTES_PER_USER} votes`,
      usedVotes,
    }
  }

  if (data.action === 'remove') {
    const entryCount = await getEntryVoteCountForUser(
      data.entryId,
      data.userId
    )
    if (entryCount <= 0) {
      return {
        success: false,
        error: 'No votes to remove on this entry',
        usedVotes,
      }
    }
  }

  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()

  await turso.execute({
    sql: `INSERT INTO vote_transactions (id, exerciseId, entryId, userId, action, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, data.exerciseId, data.entryId, data.userId, data.action, timestamp],
  })

  const newUsed =
    data.action === 'add' ? usedVotes + 1 : Math.max(0, usedVotes - 1)

  return { success: true, usedVotes: newUsed }
}

export async function getPerUserVoteSpend(
  exerciseId: string
): Promise<UserVoteSpend[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT userId,
      MIN(CASE WHEN action = 'add' THEN userId END) as uid,
      SUM(CASE WHEN action = 'add' THEN 1 ELSE -1 END) as used
      FROM vote_transactions
      WHERE exerciseId = ?
      GROUP BY userId`,
    args: [exerciseId],
  })

  // We need to join with entries to get email — we'll return userId only here
  // and let the API layer enrich
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      userId: row.userId as string,
      userEmail: '',
      used: Math.max(0, (row.used as number) ?? 0),
    }
  })
}

export async function getAllTransactionsForExercise(
  exerciseId: string
): Promise<VoteTransaction[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM vote_transactions WHERE exerciseId = ? ORDER BY timestamp ASC',
    args: [exerciseId],
  })
  return result.rows.map((r) => rowToTransaction(r as Record<string, unknown>))
}
