import { turso } from './client'
import { runMigrations } from './migrations'

export interface QAResult {
  id: string
  session_id: string
  project_id: string
  test_item_id: string
  tester_id: string
  status: 'pass' | 'fail' | 'blocked' | 'skipped' | 'not_tested'
  steps_taken: string | null
  expected_behavior: string | null
  actual_behavior: string | null
  blocked_note: string | null
  test_username: string | null
  screenshot_url: string | null
  screenshot_filename: string | null
  recorded_at: string | null
  acknowledged_at: string | null
  acknowledged_by: string | null
}

function parseResult(row: Record<string, unknown>): QAResult {
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    project_id: row.project_id as string,
    test_item_id: row.test_item_id as string,
    tester_id: row.tester_id as string,
    status: (row.status as QAResult['status']) ?? 'not_tested',
    steps_taken: (row.steps_taken as string) ?? null,
    expected_behavior: (row.expected_behavior as string) ?? null,
    actual_behavior: (row.actual_behavior as string) ?? null,
    blocked_note: (row.blocked_note as string) ?? null,
    test_username: (row.test_username as string) ?? null,
    screenshot_url: (row.screenshot_url as string) ?? null,
    screenshot_filename: (row.screenshot_filename as string) ?? null,
    recorded_at: (row.recorded_at as string) ?? null,
    acknowledged_at: (row.acknowledged_at as string) ?? null,
    acknowledged_by: (row.acknowledged_by as string) ?? null,
  }
}

export async function getResultsBySession(sessionId: string): Promise<QAResult[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_results WHERE session_id = ?',
    args: [sessionId],
  })
  return result.rows.map((r) => parseResult(r as Record<string, unknown>))
}

export async function getResultBySessionAndItem(
  sessionId: string,
  testItemId: string
): Promise<QAResult | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_results WHERE session_id = ? AND test_item_id = ?',
    args: [sessionId, testItemId],
  })
  if (!result.rows[0]) return null
  return parseResult(result.rows[0] as Record<string, unknown>)
}

export async function upsertResult(data: {
  session_id: string
  project_id: string
  test_item_id: string
  tester_id: string
  status: QAResult['status']
  steps_taken?: string | null
  expected_behavior?: string | null
  actual_behavior?: string | null
  blocked_note?: string | null
  test_username?: string | null
  screenshot_url?: string | null
  screenshot_filename?: string | null
}): Promise<QAResult> {
  await runMigrations()
  const existing = await getResultBySessionAndItem(data.session_id, data.test_item_id)
  const now = new Date().toISOString()

  if (existing) {
    await turso.execute({
      sql: `UPDATE qa_results SET
        status = ?, steps_taken = ?, expected_behavior = ?, actual_behavior = ?,
        blocked_note = ?, test_username = ?, screenshot_url = ?, screenshot_filename = ?,
        recorded_at = ?
        WHERE session_id = ? AND test_item_id = ?`,
      args: [
        data.status,
        data.steps_taken ?? existing.steps_taken,
        data.expected_behavior ?? existing.expected_behavior,
        data.actual_behavior ?? existing.actual_behavior,
        data.blocked_note ?? existing.blocked_note,
        data.test_username ?? existing.test_username,
        data.screenshot_url ?? existing.screenshot_url,
        data.screenshot_filename ?? existing.screenshot_filename,
        now,
        data.session_id,
        data.test_item_id,
      ],
    })
    return (await getResultBySessionAndItem(data.session_id, data.test_item_id))!
  } else {
    const id = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await turso.execute({
      sql: `INSERT INTO qa_results
        (id, session_id, project_id, test_item_id, tester_id, status,
         steps_taken, expected_behavior, actual_behavior, blocked_note,
         test_username, screenshot_url, screenshot_filename, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, data.session_id, data.project_id, data.test_item_id, data.tester_id,
        data.status,
        data.steps_taken ?? null,
        data.expected_behavior ?? null,
        data.actual_behavior ?? null,
        data.blocked_note ?? null,
        data.test_username ?? null,
        data.screenshot_url ?? null,
        data.screenshot_filename ?? null,
        now,
      ],
    })
    return (await getResultBySessionAndItem(data.session_id, data.test_item_id))!
  }
}

export async function updateResultScreenshot(
  sessionId: string,
  testItemId: string,
  screenshotUrl: string,
  screenshotFilename: string
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE qa_results SET screenshot_url = ?, screenshot_filename = ? WHERE session_id = ? AND test_item_id = ?',
    args: [screenshotUrl, screenshotFilename, sessionId, testItemId],
  })
}

export async function getAllResultsByProject(projectId: string): Promise<QAResult[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_results WHERE project_id = ?',
    args: [projectId],
  })
  return result.rows.map((r) => parseResult(r as Record<string, unknown>))
}

export async function getFailuresByProject(projectId: string): Promise<
  (QAResult & {
    tester_name: string
    tester_email: string
    tc_number: string
    test_description: string
    feature_area: string
    session_viewport: string
    session_browser: string
    session_os: string
    user_type: string
  })[]
> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT r.*,
      s.tester_name, s.tester_email,
      ti.tc_number, ti.test_description, ti.feature_area,
      s.viewport AS session_viewport, s.browser AS session_browser,
      s.operating_system AS session_os, s.user_type
      FROM qa_results r
      JOIN qa_sessions s ON s.id = r.session_id
      JOIN qa_test_items ti ON ti.id = r.test_item_id
      WHERE r.project_id = ? AND r.status = 'fail' AND r.acknowledged_at IS NULL
      ORDER BY r.recorded_at DESC`,
    args: [projectId],
  })
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      ...parseResult(row),
      tester_name: (row.tester_name as string) ?? '',
      tester_email: (row.tester_email as string) ?? '',
      tc_number: (row.tc_number as string) ?? '',
      test_description: (row.test_description as string) ?? '',
      feature_area: (row.feature_area as string) ?? '',
      session_viewport: (row.session_viewport as string) ?? '',
      session_browser: (row.session_browser as string) ?? '',
      session_os: (row.session_os as string) ?? '',
      user_type: (row.user_type as string) ?? '',
    }
  })
}

export async function acknowledgeResult(resultId: string, adminUserId: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE qa_results SET acknowledged_at = ?, acknowledged_by = ? WHERE id = ?',
    args: [new Date().toISOString(), adminUserId, resultId],
  })
}

export async function getTesterUsernames(
  testerId: string,
  projectId: string
): Promise<string[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT DISTINCT username FROM qa_tester_usernames
      WHERE tester_id = ? AND project_id = ?
      ORDER BY used_at DESC LIMIT 10`,
    args: [testerId, projectId],
  })
  return result.rows.map((r) => (r as Record<string, unknown>).username as string)
}

export async function saveTesterUsername(
  testerId: string,
  projectId: string,
  username: string
): Promise<void> {
  await runMigrations()
  const id = `tu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  // Upsert: delete old entry for same username, re-insert with fresh timestamp
  await turso.execute({
    sql: 'DELETE FROM qa_tester_usernames WHERE tester_id = ? AND project_id = ? AND username = ?',
    args: [testerId, projectId, username],
  })
  await turso.execute({
    sql: 'INSERT INTO qa_tester_usernames (id, tester_id, project_id, username, used_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, testerId, projectId, username, now],
  })
}
