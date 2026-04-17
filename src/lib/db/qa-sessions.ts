import { turso } from './client'
import { runMigrations } from './migrations'

export interface QASession {
  id: string
  project_id: string
  tester_id: string
  tester_name: string
  tester_email: string
  user_type: string
  viewport: string
  operating_system: string
  browser: string
  started_at: string
  last_active_at: string
}

function parseSession(row: Record<string, unknown>): QASession {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    tester_id: row.tester_id as string,
    tester_name: (row.tester_name as string) ?? '',
    tester_email: (row.tester_email as string) ?? '',
    user_type: (row.user_type as string) ?? '',
    viewport: (row.viewport as string) ?? '',
    operating_system: (row.operating_system as string) ?? '',
    browser: (row.browser as string) ?? '',
    started_at: row.started_at as string,
    last_active_at: row.last_active_at as string,
  }
}

export async function getSessionById(id: string): Promise<QASession | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_sessions WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseSession(result.rows[0] as Record<string, unknown>)
}

export async function getSessionsByProject(projectId: string): Promise<QASession[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_sessions WHERE project_id = ? ORDER BY last_active_at DESC',
    args: [projectId],
  })
  return result.rows.map((r) => parseSession(r as Record<string, unknown>))
}

export async function getSessionsByTesterAndProject(
  testerId: string,
  projectId: string
): Promise<QASession[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_sessions WHERE tester_id = ? AND project_id = ? ORDER BY last_active_at DESC',
    args: [testerId, projectId],
  })
  return result.rows.map((r) => parseSession(r as Record<string, unknown>))
}

export async function createSession(data: {
  id: string
  project_id: string
  tester_id: string
  tester_name: string
  tester_email: string
  user_type: string
  viewport: string
  operating_system: string
  browser: string
}): Promise<QASession> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO qa_sessions
      (id, project_id, tester_id, tester_name, tester_email, user_type, viewport, operating_system, browser, started_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.id, data.project_id, data.tester_id, data.tester_name,
      data.tester_email, data.user_type, data.viewport, data.operating_system,
      data.browser, now, now,
    ],
  })
  return (await getSessionById(data.id))!
}

export async function getUserTypeTesterCounts(
  projectId: string,
  excludeTesterId: string
): Promise<Record<string, number>> {
  await runMigrations()
  const result = await turso.execute({
    sql: `
      SELECT user_type, COUNT(DISTINCT tester_id) AS tester_count
      FROM qa_sessions
      WHERE project_id = ? AND tester_id != ?
      GROUP BY user_type
    `,
    args: [projectId, excludeTesterId],
  })
  const counts: Record<string, number> = {}
  for (const row of result.rows) {
    const r = row as Record<string, unknown>
    counts[r.user_type as string] = Number(r.tester_count ?? 0)
  }
  return counts
}

export async function touchSession(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE qa_sessions SET last_active_at = ? WHERE id = ?',
    args: [new Date().toISOString(), id],
  })
}

export interface SessionWithProgress extends QASession {
  total: number
  done: number
  passed: number
  failed: number
  blocked: number
  skipped: number
}

export async function getSessionsWithProgress(projectId: string): Promise<SessionWithProgress[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: `
      SELECT
        s.*,
        COUNT(ti.id) AS total,
        SUM(CASE WHEN r.status IN ('pass','fail','blocked','skipped') THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN r.status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN r.status = 'fail' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN r.status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN r.status = 'skipped' THEN 1 ELSE 0 END) AS skipped
      FROM qa_sessions s
      JOIN qa_test_items ti ON ti.project_id = s.project_id
      LEFT JOIN qa_results r ON r.session_id = s.id AND r.test_item_id = ti.id
      WHERE s.project_id = ?
      GROUP BY s.id
      ORDER BY s.last_active_at DESC
    `,
    args: [projectId],
  })
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      ...parseSession(row),
      total: Number(row.total ?? 0),
      done: Number(row.done ?? 0),
      passed: Number(row.passed ?? 0),
      failed: Number(row.failed ?? 0),
      blocked: Number(row.blocked ?? 0),
      skipped: Number(row.skipped ?? 0),
    }
  })
}

export async function getTesterSessionsWithProgress(
  testerId: string,
  projectId: string
): Promise<SessionWithProgress[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: `
      SELECT
        s.*,
        COUNT(ti.id) AS total,
        SUM(CASE WHEN r.status IN ('pass','fail','blocked','skipped') THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN r.status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN r.status = 'fail' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN r.status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN r.status = 'skipped' THEN 1 ELSE 0 END) AS skipped
      FROM qa_sessions s
      JOIN qa_test_items ti ON ti.project_id = s.project_id
      LEFT JOIN qa_results r ON r.session_id = s.id AND r.test_item_id = ti.id
      WHERE s.tester_id = ? AND s.project_id = ?
      GROUP BY s.id
      ORDER BY s.last_active_at DESC
    `,
    args: [testerId, projectId],
  })
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      ...parseSession(row),
      total: Number(row.total ?? 0),
      done: Number(row.done ?? 0),
      passed: Number(row.passed ?? 0),
      failed: Number(row.failed ?? 0),
      blocked: Number(row.blocked ?? 0),
      skipped: Number(row.skipped ?? 0),
    }
  })
}
