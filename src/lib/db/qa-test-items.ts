import { turso } from './client'
import { runMigrations } from './migrations'

export interface QATestItem {
  id: string
  project_id: string
  tc_number: string
  part: string
  section: string
  feature_area: string
  platform: string
  user_type: string
  test_description: string
  steps: string
  expected_result: string
  jira_reference: string
  needs_review: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

function parseItem(row: Record<string, unknown>): QATestItem {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    tc_number: (row.tc_number as string) ?? '',
    part: (row.part as string) ?? '',
    section: (row.section as string) ?? '',
    feature_area: (row.feature_area as string) ?? '',
    platform: (row.platform as string) ?? '',
    user_type: (row.user_type as string) ?? '',
    test_description: (row.test_description as string) ?? '',
    steps: (row.steps as string) ?? '',
    expected_result: (row.expected_result as string) ?? '',
    jira_reference: (row.jira_reference as string) ?? '',
    needs_review: row.needs_review === 1 || row.needs_review === true,
    sort_order: (row.sort_order as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function getTestItemsByProject(projectId: string): Promise<QATestItem[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_test_items WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [projectId],
  })
  return result.rows.map((r) => parseItem(r as Record<string, unknown>))
}

export async function getTestItemById(id: string): Promise<QATestItem | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_test_items WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseItem(result.rows[0] as Record<string, unknown>)
}

export async function createTestItem(data: {
  id: string
  project_id: string
  tc_number: string
  part: string
  section: string
  feature_area: string
  platform: string
  user_type: string
  test_description: string
  steps: string
  expected_result: string
  jira_reference: string
  needs_review: boolean
  sort_order: number
}): Promise<QATestItem> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO qa_test_items
      (id, project_id, tc_number, part, section, feature_area, platform, user_type,
       test_description, steps, expected_result, jira_reference, needs_review, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.id, data.project_id, data.tc_number, data.part, data.section,
      data.feature_area, data.platform, data.user_type, data.test_description,
      data.steps, data.expected_result, data.jira_reference,
      data.needs_review ? 1 : 0, data.sort_order, now, now,
    ],
  })
  return (await getTestItemById(data.id))!
}

export async function bulkCreateTestItems(
  projectId: string,
  items: Omit<QATestItem, 'id' | 'project_id' | 'created_at' | 'updated_at'>[]
): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  for (const item of items) {
    const id = `ti_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await turso.execute({
      sql: `INSERT INTO qa_test_items
        (id, project_id, tc_number, part, section, feature_area, platform, user_type,
         test_description, steps, expected_result, jira_reference, needs_review, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, projectId, item.tc_number, item.part, item.section,
        item.feature_area, item.platform, item.user_type, item.test_description,
        item.steps, item.expected_result, item.jira_reference,
        item.needs_review ? 1 : 0, item.sort_order, now, now,
      ],
    })
  }
}

export async function updateTestItem(
  id: string,
  data: Partial<Omit<QATestItem, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
): Promise<QATestItem | null> {
  await runMigrations()
  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: any[] = [now]

  const fieldMap: Record<string, string> = {
    tc_number: 'tc_number', part: 'part', section: 'section',
    feature_area: 'feature_area', platform: 'platform', user_type: 'user_type',
    test_description: 'test_description', steps: 'steps',
    expected_result: 'expected_result', jira_reference: 'jira_reference',
    sort_order: 'sort_order',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if (data[key as keyof typeof data] !== undefined) {
      fields.push(`${col} = ?`)
      args.push(data[key as keyof typeof data])
    }
  }
  if (data.needs_review !== undefined) {
    fields.push('needs_review = ?')
    args.push(data.needs_review ? 1 : 0)
  }

  args.push(id)
  await turso.execute({
    sql: `UPDATE qa_test_items SET ${fields.join(', ')} WHERE id = ?`,
    args,
  })
  return getTestItemById(id)
}

export async function deleteTestItem(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM qa_test_items WHERE id = ?', args: [id] })
}

export async function reorderTestItems(
  projectId: string,
  orderedIds: string[]
): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  for (let i = 0; i < orderedIds.length; i++) {
    await turso.execute({
      sql: 'UPDATE qa_test_items SET sort_order = ?, updated_at = ? WHERE id = ? AND project_id = ?',
      args: [i, now, orderedIds[i], projectId],
    })
  }
}

export async function getTestItemsByUserType(projectId: string, userType: string): Promise<QATestItem[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_test_items WHERE project_id = ? AND user_type = ? ORDER BY sort_order ASC, created_at ASC',
    args: [projectId, userType],
  })
  return result.rows.map((r) => parseItem(r as Record<string, unknown>))
}

export async function getTestItemCountsByUserType(projectId: string): Promise<Record<string, number>> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT user_type, COUNT(*) as count FROM qa_test_items WHERE project_id = ? GROUP BY user_type',
    args: [projectId],
  })
  const counts: Record<string, number> = {}
  for (const row of result.rows) {
    counts[row.user_type as string] = Number(row.count)
  }
  return counts
}

export async function deleteTestItemsByProject(projectId: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'DELETE FROM qa_test_items WHERE project_id = ?',
    args: [projectId],
  })
}

export async function deleteTestItemsByUserType(projectId: string, userType: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'DELETE FROM qa_test_items WHERE project_id = ? AND user_type = ?',
    args: [projectId, userType],
  })
}
