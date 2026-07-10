import { turso } from './client'
import { runMigrations } from './migrations'

export interface Prototype {
  id: string
  slug: string
  name: string
  status: 'active' | 'archived'
  blob_pathname: string
  blob_url: string
  file_size: number
  created_by: string
  created_by_name: string
  created_via: 'web' | 'api'
  created_at: string
  updated_at: string
}

export function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

function parsePrototype(row: Record<string, unknown>): Prototype {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    status: (row.status as Prototype['status']) ?? 'active',
    blob_pathname: row.blob_pathname as string,
    blob_url: row.blob_url as string,
    file_size: Number(row.file_size ?? 0),
    created_by: row.created_by as string,
    created_by_name: (row.created_by_name as string) ?? '',
    created_via: (row.created_via as Prototype['created_via']) ?? 'web',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function getAllPrototypes(): Promise<Prototype[]> {
  await runMigrations()
  const result = await turso.execute('SELECT * FROM prototypes ORDER BY created_at DESC')
  return result.rows.map((r) => parsePrototype(r as Record<string, unknown>))
}

export async function getActivePrototypes(): Promise<Prototype[]> {
  await runMigrations()
  const result = await turso.execute(
    "SELECT * FROM prototypes WHERE status = 'active' ORDER BY created_at DESC"
  )
  return result.rows.map((r) => parsePrototype(r as Record<string, unknown>))
}

export async function getPrototypeById(id: string): Promise<Prototype | null> {
  await runMigrations()
  const result = await turso.execute({ sql: 'SELECT * FROM prototypes WHERE id = ?', args: [id] })
  if (!result.rows[0]) return null
  return parsePrototype(result.rows[0] as Record<string, unknown>)
}

export async function getPrototypeBySlug(slug: string): Promise<Prototype | null> {
  await runMigrations()
  const result = await turso.execute({ sql: 'SELECT * FROM prototypes WHERE slug = ? LIMIT 1', args: [slug] })
  if (!result.rows[0]) return null
  return parsePrototype(result.rows[0] as Record<string, unknown>)
}

// Appends -2, -3, ... until a free slug is found. Prototypes get repeat names
// ("checkout redesign") far more often than QA projects do, so unlike QA's
// generateSlug this needs a real uniqueness pass. Callers resolve the slug
// before uploading, since the blob pathname is derived from it.
export async function reserveSlug(name: string, fallback: string): Promise<string> {
  await runMigrations()
  const base = generateSlug(name) || fallback
  let slug = base
  let n = 2
  while (await getPrototypeBySlug(slug)) {
    slug = `${base}-${n}`
    n += 1
  }
  return slug
}

export async function createPrototype(data: {
  id: string
  slug: string
  name: string
  blob_pathname: string
  blob_url: string
  file_size: number
  created_by: string
  created_by_name: string
  created_via: 'web' | 'api'
}): Promise<Prototype> {
  await runMigrations()
  const now = new Date().toISOString()
  const { slug } = data
  await turso.execute({
    sql: `INSERT INTO prototypes (id, slug, name, status, blob_pathname, blob_url, file_size, created_by, created_by_name, created_via, created_at, updated_at)
          VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.id,
      slug,
      data.name,
      data.blob_pathname,
      data.blob_url,
      data.file_size,
      data.created_by,
      data.created_by_name,
      data.created_via,
      now,
      now,
    ],
  })
  return (await getPrototypeById(data.id))!
}

export async function updatePrototypeMeta(
  id: string,
  data: Partial<{ name: string; status: Prototype['status'] }>
): Promise<Prototype | null> {
  await runMigrations()
  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const args: (string | number)[] = [now]

  if (data.name !== undefined) { fields.push('name = ?'); args.push(data.name) }
  if (data.status !== undefined) { fields.push('status = ?'); args.push(data.status) }

  args.push(id)
  await turso.execute({ sql: `UPDATE prototypes SET ${fields.join(', ')} WHERE id = ?`, args })
  return getPrototypeById(id)
}

export async function replacePrototypeFile(
  id: string,
  data: { blob_url: string; file_size: number }
): Promise<Prototype | null> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: 'UPDATE prototypes SET blob_url = ?, file_size = ?, updated_at = ? WHERE id = ?',
    args: [data.blob_url, data.file_size, now, id],
  })
  return getPrototypeById(id)
}

export async function deletePrototype(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM prototypes WHERE id = ?', args: [id] })
}
