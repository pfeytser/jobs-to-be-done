import { turso } from './client'
import { runMigrations } from './migrations'

export interface AppUser {
  user_id: string
  email: string
  name: string | null
  image: string | null
  first_seen_at: string
  last_seen_at: string
}

function parseUser(row: Record<string, unknown>): AppUser {
  return {
    user_id: row.user_id as string,
    email: row.email as string,
    name: (row.name as string) ?? null,
    image: (row.image as string) ?? null,
    first_seen_at: row.first_seen_at as string,
    last_seen_at: row.last_seen_at as string,
  }
}

/**
 * Registers (or refreshes) a user on login. Called from the root layout on
 * every authenticated page load so any @industriousoffice.com account is
 * auto-registered the first time they sign in.
 */
export async function recordUser(data: {
  userId: string
  email: string
  name?: string | null
  image?: string | null
}): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO users (user_id, email, name, image, first_seen_at, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            email = excluded.email,
            name = COALESCE(excluded.name, name),
            image = COALESCE(excluded.image, image),
            last_seen_at = excluded.last_seen_at`,
    args: [data.userId, data.email, data.name ?? null, data.image ?? null, now, now],
  })
}

export async function getAllUsers(): Promise<AppUser[]> {
  await runMigrations()
  const result = await turso.execute(
    'SELECT * FROM users ORDER BY name COLLATE NOCASE ASC, email ASC'
  )
  return result.rows.map((r) => parseUser(r as Record<string, unknown>))
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM users WHERE user_id = ?',
    args: [userId],
  })
  if (!result.rows[0]) return null
  return parseUser(result.rows[0] as Record<string, unknown>)
}
