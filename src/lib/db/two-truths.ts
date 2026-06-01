import { turso } from './client'
import { runMigrations } from './migrations'

export type TtStatus = 'draft' | 'active' | 'completed' | 'archived'

export interface TtSession {
  id: string
  title: string
  author_id: string
  author_name: string
  author_email: string
  status: TtStatus
  created_by: string
  created_at: string
  updated_at: string
  activated_at: string | null
  revealed_at: string | null
  archived_at: string | null
}

export interface TtStatement {
  id: string
  session_id: string
  text: string
  is_lie: boolean
  position: number
  display_order: number
}

export interface TtVote {
  id: string
  session_id: string
  statement_id: string
  voter_id: string
  voter_name: string
  voter_email: string
  created_at: string
}

function parseSession(row: Record<string, unknown>): TtSession {
  return {
    id: row.id as string,
    title: row.title as string,
    author_id: row.author_id as string,
    author_name: (row.author_name as string) ?? '',
    author_email: (row.author_email as string) ?? '',
    status: (row.status as TtStatus) ?? 'draft',
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    activated_at: (row.activated_at as string) ?? null,
    revealed_at: (row.revealed_at as string) ?? null,
    archived_at: (row.archived_at as string) ?? null,
  }
}

function parseStatement(row: Record<string, unknown>): TtStatement {
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    text: (row.text as string) ?? '',
    is_lie: Boolean(row.is_lie),
    position: Number(row.position ?? 0),
    display_order: Number(row.display_order ?? 0),
  }
}

function parseVote(row: Record<string, unknown>): TtVote {
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    statement_id: row.statement_id as string,
    voter_id: row.voter_id as string,
    voter_name: (row.voter_name as string) ?? '',
    voter_email: (row.voter_email as string) ?? '',
    created_at: row.created_at as string,
  }
}

// ── Sessions ───────────────────────────────────────────────────────────────

export async function getSessionById(id: string): Promise<TtSession | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM tt_sessions WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseSession(result.rows[0] as Record<string, unknown>)
}

export async function getAllSessions(): Promise<TtSession[]> {
  await runMigrations()
  const result = await turso.execute('SELECT * FROM tt_sessions ORDER BY created_at DESC')
  return result.rows.map((r) => parseSession(r as Record<string, unknown>))
}

/** Active + completed sessions, newest first — what players may browse. */
export async function getVisibleSessions(): Promise<TtSession[]> {
  await runMigrations()
  const result = await turso.execute(
    "SELECT * FROM tt_sessions WHERE status IN ('active', 'completed') ORDER BY created_at DESC"
  )
  return result.rows.map((r) => parseSession(r as Record<string, unknown>))
}

/** Draft sessions awaiting setup by a given author. */
export async function getDraftSessionsForAuthor(authorId: string): Promise<TtSession[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: "SELECT * FROM tt_sessions WHERE author_id = ? AND status = 'draft' ORDER BY created_at DESC",
    args: [authorId],
  })
  return result.rows.map((r) => parseSession(r as Record<string, unknown>))
}

export async function createSession(data: {
  id: string
  title: string
  author_id: string
  author_name: string
  author_email: string
  created_by: string
}): Promise<TtSession> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO tt_sessions (id, title, author_id, author_name, author_email, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    args: [data.id, data.title, data.author_id, data.author_name, data.author_email, data.created_by, now, now],
  })
  // Seed three empty statements (positions 1–3) for the author to fill in.
  for (let position = 1; position <= 3; position++) {
    await turso.execute({
      sql: `INSERT INTO tt_statements (id, session_id, text, is_lie, position, display_order, created_at, updated_at)
            VALUES (?, ?, '', ?, ?, ?, ?, ?)`,
      args: [`tts_${data.id}_${position}`, data.id, position === 3 ? 1 : 0, position, position, now, now],
    })
  }
  return (await getSessionById(data.id))!
}

export async function deleteSession(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM tt_sessions WHERE id = ?', args: [id] })
}

async function setStatus(
  id: string,
  status: TtStatus,
  timestampColumn?: 'activated_at' | 'revealed_at' | 'archived_at'
): Promise<TtSession | null> {
  await runMigrations()
  const now = new Date().toISOString()
  const sets = ['status = ?', 'updated_at = ?']
  const args: (string | number)[] = [status, now]
  if (timestampColumn) {
    sets.push(`${timestampColumn} = ?`)
    args.push(now)
  }
  args.push(id)
  await turso.execute({ sql: `UPDATE tt_sessions SET ${sets.join(', ')} WHERE id = ?`, args })
  return getSessionById(id)
}

/** Locks the author's statements, randomizes display order, goes live. */
export async function activateSession(id: string): Promise<TtSession | null> {
  await runMigrations()
  const statements = await getStatements(id)
  const orders = statements.map((s) => s.position)
  // Fisher–Yates shuffle of the display positions.
  for (let i = orders.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[orders[i], orders[j]] = [orders[j], orders[i]]
  }
  const now = new Date().toISOString()
  for (let i = 0; i < statements.length; i++) {
    await turso.execute({
      sql: 'UPDATE tt_statements SET display_order = ?, updated_at = ? WHERE id = ?',
      args: [orders[i], now, statements[i].id],
    })
  }
  return setStatus(id, 'active', 'activated_at')
}

export async function revealSession(id: string): Promise<TtSession | null> {
  return setStatus(id, 'completed', 'revealed_at')
}

export async function archiveSession(id: string): Promise<TtSession | null> {
  return setStatus(id, 'archived', 'archived_at')
}

/** Reopens a revealed session for voting (completed → active), hiding results
 * again. Keeps the existing shuffled order and any votes already cast. */
export async function reopenSession(id: string): Promise<TtSession | null> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: "UPDATE tt_sessions SET status = 'active', revealed_at = NULL, updated_at = ? WHERE id = ?",
    args: [now, id],
  })
  return getSessionById(id)
}

/** Restores an archived session to completed (its pre-archive state). */
export async function unarchiveSession(id: string): Promise<TtSession | null> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: "UPDATE tt_sessions SET status = 'completed', archived_at = NULL, updated_at = ? WHERE id = ?",
    args: [now, id],
  })
  return getSessionById(id)
}

// ── Statements ───────────────────────────────────────────────────────────────

export async function getStatements(sessionId: string): Promise<TtStatement[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM tt_statements WHERE session_id = ? ORDER BY position ASC',
    args: [sessionId],
  })
  return result.rows.map((r) => parseStatement(r as Record<string, unknown>))
}

/** Statements in the shuffled order shown to players. */
export async function getStatementsForDisplay(sessionId: string): Promise<TtStatement[]> {
  const statements = await getStatements(sessionId)
  return statements.sort((a, b) => a.display_order - b.display_order)
}

/** Overwrites the three statements while a session is still in draft. */
export async function saveStatements(
  sessionId: string,
  statements: Array<{ text: string; is_lie: boolean }>
): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  const existing = await getStatements(sessionId)
  for (let i = 0; i < existing.length; i++) {
    const incoming = statements[i]
    if (!incoming) continue
    await turso.execute({
      sql: 'UPDATE tt_statements SET text = ?, is_lie = ?, updated_at = ? WHERE id = ?',
      args: [incoming.text, incoming.is_lie ? 1 : 0, now, existing[i].id],
    })
  }
  await turso.execute({
    sql: 'UPDATE tt_sessions SET updated_at = ? WHERE id = ?',
    args: [now, sessionId],
  })
}

// ── Votes ───────────────────────────────────────────────────────────────────

export async function getVoteForUser(
  sessionId: string,
  voterId: string
): Promise<TtVote | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM tt_votes WHERE session_id = ? AND voter_id = ?',
    args: [sessionId, voterId],
  })
  if (!result.rows[0]) return null
  return parseVote(result.rows[0] as Record<string, unknown>)
}

export async function getVotesForSession(sessionId: string): Promise<TtVote[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM tt_votes WHERE session_id = ? ORDER BY created_at ASC',
    args: [sessionId],
  })
  return result.rows.map((r) => parseVote(r as Record<string, unknown>))
}

/** Records a single immutable vote. Returns false if the user already voted. */
export async function castVote(data: {
  id: string
  session_id: string
  statement_id: string
  voter_id: string
  voter_name: string
  voter_email: string
}): Promise<boolean> {
  await runMigrations()
  const existing = await getVoteForUser(data.session_id, data.voter_id)
  if (existing) return false
  try {
    await turso.execute({
      sql: `INSERT INTO tt_votes (id, session_id, statement_id, voter_id, voter_name, voter_email, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.id,
        data.session_id,
        data.statement_id,
        data.voter_id,
        data.voter_name,
        data.voter_email,
        new Date().toISOString(),
      ],
    })
    return true
  } catch {
    // Unique index collision — a concurrent vote landed first.
    return false
  }
}
