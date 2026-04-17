import { turso } from './client'
import { runMigrations } from './migrations'

export interface QAProject {
  id: string
  slug: string
  name: string
  description: string
  platform: string
  viewports: string[]
  operating_systems: string[]
  browsers: string[]
  user_types: string[]
  status: 'draft' | 'active' | 'complete' | 'archived'
  created_by: string
  created_at: string
  updated_at: string
}

export function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

function parseProject(row: Record<string, unknown>): QAProject {
  return {
    id: row.id as string,
    slug: (row.slug as string) ?? '',
    name: row.name as string,
    description: (row.description as string) ?? '',
    platform: (row.platform as string) ?? 'Web',
    viewports: JSON.parse((row.viewports as string) ?? '[]'),
    operating_systems: JSON.parse((row.operating_systems as string) ?? '[]'),
    browsers: JSON.parse((row.browsers as string) ?? '[]'),
    user_types: JSON.parse((row.user_types as string) ?? '[]'),
    status: (row.status as QAProject['status']) ?? 'draft',
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function getAllQAProjects(): Promise<QAProject[]> {
  await runMigrations()
  const result = await turso.execute(
    'SELECT * FROM qa_projects ORDER BY created_at DESC'
  )
  return result.rows.map((r) => parseProject(r as Record<string, unknown>))
}

export async function getActiveQAProjects(): Promise<QAProject[]> {
  await runMigrations()
  const result = await turso.execute(
    "SELECT * FROM qa_projects WHERE status = 'active' ORDER BY created_at DESC"
  )
  return result.rows.map((r) => parseProject(r as Record<string, unknown>))
}

export async function getQAProjectById(id: string): Promise<QAProject | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_projects WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseProject(result.rows[0] as Record<string, unknown>)
}

export async function getQAProjectBySlug(slug: string): Promise<QAProject | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM qa_projects WHERE slug = ? LIMIT 1',
    args: [slug],
  })
  if (!result.rows[0]) return null
  return parseProject(result.rows[0] as Record<string, unknown>)
}

export async function createQAProject(data: {
  id: string
  name: string
  description: string
  platform: string
  viewports: string[]
  operating_systems: string[]
  browsers: string[]
  user_types: string[]
  created_by: string
}): Promise<QAProject> {
  await runMigrations()
  const now = new Date().toISOString()
  const slug = generateSlug(data.name) || data.id.slice(-8)
  await turso.execute({
    sql: `INSERT INTO qa_projects (id, slug, name, description, platform, viewports, operating_systems, browsers, user_types, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    args: [
      data.id,
      slug,
      data.name,
      data.description,
      data.platform,
      JSON.stringify(data.viewports),
      JSON.stringify(data.operating_systems),
      JSON.stringify(data.browsers),
      JSON.stringify(data.user_types),
      data.created_by,
      now,
      now,
    ],
  })
  return (await getQAProjectById(data.id))!
}

export async function updateQAProject(
  id: string,
  data: Partial<{
    name: string
    description: string
    platform: string
    viewports: string[]
    operating_systems: string[]
    browsers: string[]
    user_types: string[]
    status: QAProject['status']
  }>
): Promise<QAProject | null> {
  await runMigrations()
  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: any[] = [now]

  if (data.name !== undefined) { fields.push('name = ?'); args.push(data.name) }
  if (data.description !== undefined) { fields.push('description = ?'); args.push(data.description) }
  if (data.platform !== undefined) { fields.push('platform = ?'); args.push(data.platform) }
  if (data.viewports !== undefined) { fields.push('viewports = ?'); args.push(JSON.stringify(data.viewports)) }
  if (data.operating_systems !== undefined) { fields.push('operating_systems = ?'); args.push(JSON.stringify(data.operating_systems)) }
  if (data.browsers !== undefined) { fields.push('browsers = ?'); args.push(JSON.stringify(data.browsers)) }
  if (data.user_types !== undefined) { fields.push('user_types = ?'); args.push(JSON.stringify(data.user_types)) }
  if (data.status !== undefined) { fields.push('status = ?'); args.push(data.status) }

  args.push(id)
  await turso.execute({
    sql: `UPDATE qa_projects SET ${fields.join(', ')} WHERE id = ?`,
    args,
  })
  return getQAProjectById(id)
}

export async function deleteQAProject(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM qa_projects WHERE id = ?', args: [id] })
}
