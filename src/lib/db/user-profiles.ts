import { turso } from './client'
import { runMigrations } from './migrations'

export interface UserProfile {
  user_id: string
  sea_creature: string | null
  sea_creature_why: string | null
  sea_creature_avatar: string | null
  sea_creature_skipped: boolean
  updated_at: string
}

function parseProfile(row: Record<string, unknown>): UserProfile {
  return {
    user_id: row.user_id as string,
    sea_creature: (row.sea_creature as string) ?? null,
    sea_creature_why: (row.sea_creature_why as string) ?? null,
    sea_creature_avatar: (row.sea_creature_avatar as string) ?? null,
    sea_creature_skipped: Boolean(row.sea_creature_skipped),
    updated_at: row.updated_at as string,
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM user_profiles WHERE user_id = ?',
    args: [userId],
  })
  if (!result.rows[0]) return null
  return parseProfile(result.rows[0] as Record<string, unknown>)
}

export async function upsertUserProfile(
  userId: string,
  data: {
    sea_creature?: string | null
    sea_creature_why?: string | null
    sea_creature_skipped?: boolean
  }
): Promise<UserProfile> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO user_profiles (user_id, sea_creature, sea_creature_why, sea_creature_skipped, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            sea_creature = COALESCE(excluded.sea_creature, sea_creature),
            sea_creature_why = COALESCE(excluded.sea_creature_why, sea_creature_why),
            sea_creature_skipped = CASE WHEN excluded.sea_creature_skipped = 1 THEN 1 ELSE sea_creature_skipped END,
            updated_at = excluded.updated_at`,
    args: [
      userId,
      data.sea_creature ?? null,
      data.sea_creature_why ?? null,
      data.sea_creature_skipped ? 1 : 0,
      now,
    ],
  })
  const profile = await getUserProfile(userId)
  return profile!
}

export async function saveSeaCreatureAvatar(userId: string, avatarUrl: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: `INSERT INTO user_profiles (user_id, sea_creature_avatar, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            sea_creature_avatar = excluded.sea_creature_avatar,
            updated_at = excluded.updated_at`,
    args: [userId, avatarUrl, new Date().toISOString()],
  })
}
