import { turso } from './client'
import { runMigrations } from './migrations'

export interface Storyboard {
  id: string
  use_case_id: string
  user_id: string
  customer_name: string
  customer_demographics: string
  company_type: string
  customer_role: string
  created_at: string
  updated_at: string
}

function parseStoryboard(row: Record<string, unknown>): Storyboard {
  return {
    id: row.id as string,
    use_case_id: row.use_case_id as string,
    user_id: row.user_id as string,
    customer_name: (row.customer_name as string) ?? '',
    customer_demographics: (row.customer_demographics as string) ?? '',
    company_type: (row.company_type as string) ?? '',
    customer_role: (row.customer_role as string) ?? '',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function getStoryboard(useCaseId: string, userId: string): Promise<Storyboard | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM storyboards WHERE use_case_id = ? AND user_id = ?',
    args: [useCaseId, userId],
  })
  if (!result.rows[0]) return null
  return parseStoryboard(result.rows[0] as Record<string, unknown>)
}

export async function getStoryboardById(id: string): Promise<Storyboard | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM storyboards WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseStoryboard(result.rows[0] as Record<string, unknown>)
}

export async function upsertStoryboard(data: {
  id: string
  use_case_id: string
  user_id: string
  customer_name?: string
  customer_demographics?: string
  company_type?: string
  customer_role?: string
}): Promise<Storyboard> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO storyboards (id, use_case_id, user_id, customer_name, customer_demographics, company_type, customer_role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(use_case_id, user_id) DO UPDATE SET
            customer_name = excluded.customer_name,
            customer_demographics = excluded.customer_demographics,
            company_type = excluded.company_type,
            customer_role = excluded.customer_role,
            updated_at = excluded.updated_at`,
    args: [
      data.id,
      data.use_case_id,
      data.user_id,
      data.customer_name ?? '',
      data.customer_demographics ?? '',
      data.company_type ?? '',
      data.customer_role ?? '',
      now,
      now,
    ],
  })
  return (await getStoryboard(data.use_case_id, data.user_id))!
}
