import { turso } from './client'
import { runMigrations } from './migrations'
import type { InValue } from '@libsql/client'

export type UseCaseStatus = 'draft' | 'create' | 'present' | 'archive'

export interface StoryboardUseCase {
  id: string
  name: string
  description: string
  status: UseCaseStatus
  created_by: string
  created_at: string
  updated_at: string
}

function parseUseCase(row: Record<string, unknown>): StoryboardUseCase {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    status: (row.status as UseCaseStatus) ?? 'draft',
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function getAllUseCases(): Promise<StoryboardUseCase[]> {
  await runMigrations()
  const result = await turso.execute(
    'SELECT * FROM storyboard_use_cases ORDER BY created_at DESC'
  )
  return result.rows.map((r) => parseUseCase(r as Record<string, unknown>))
}

export async function getActiveUseCases(): Promise<StoryboardUseCase[]> {
  await runMigrations()
  const result = await turso.execute(
    "SELECT * FROM storyboard_use_cases WHERE status IN ('create', 'present') ORDER BY created_at DESC"
  )
  return result.rows.map((r) => parseUseCase(r as Record<string, unknown>))
}

export async function getUseCaseById(id: string): Promise<StoryboardUseCase | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM storyboard_use_cases WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseUseCase(result.rows[0] as Record<string, unknown>)
}

export async function createUseCase(data: {
  id: string
  name: string
  description: string
  created_by: string
}): Promise<StoryboardUseCase> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO storyboard_use_cases (id, name, description, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
    args: [data.id, data.name, data.description, data.created_by, now, now],
  })
  return (await getUseCaseById(data.id))!
}

export async function updateUseCase(
  id: string,
  data: Partial<Pick<StoryboardUseCase, 'name' | 'description' | 'status'>>
): Promise<StoryboardUseCase | null> {
  await runMigrations()
  const now = new Date().toISOString()
  const sets: string[] = ['updated_at = ?']
  const args: InValue[] = [now]

  if (data.name !== undefined) { sets.push('name = ?'); args.push(data.name) }
  if (data.description !== undefined) { sets.push('description = ?'); args.push(data.description) }
  if (data.status !== undefined) { sets.push('status = ?'); args.push(data.status) }

  args.push(id)
  await turso.execute({
    sql: `UPDATE storyboard_use_cases SET ${sets.join(', ')} WHERE id = ?`,
    args,
  })
  return getUseCaseById(id)
}
