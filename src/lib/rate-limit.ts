import { turso } from '@/lib/db/client'

// Fixed-window per-key rate limiter backed by the existing Turso database, so it
// needs no extra infrastructure. Used to cap expensive per-user actions
// (e.g. DALL-E image generation) against cost-abuse / DoS.

let ready: Promise<void> | null = null

function ensureTable(): Promise<void> {
  if (!ready) {
    ready = turso
      .execute(
        `CREATE TABLE IF NOT EXISTS rate_limits (
          bucket TEXT PRIMARY KEY,
          count INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )`
      )
      .then(() => undefined)
      .catch((err) => {
        // Reset so a transient failure can be retried on the next call.
        ready = null
        throw err
      })
  }
  return ready
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Allow up to `limit` calls per `windowSec` window for the given `key`.
 * Fails open (allowed) if the datastore is unreachable — availability over a
 * hard cap, since this guards cost, not a security boundary.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % windowSec)
  const resetAt = windowStart + windowSec
  const bucket = `${key}:${windowStart}`

  try {
    await ensureTable()

    await turso.execute({
      sql: `INSERT INTO rate_limits (bucket, count, expires_at)
            VALUES (?, 1, ?)
            ON CONFLICT(bucket) DO UPDATE SET count = count + 1`,
      args: [bucket, resetAt],
    })

    const res = await turso.execute({
      sql: 'SELECT count FROM rate_limits WHERE bucket = ?',
      args: [bucket],
    })
    const count = Number(res.rows[0]?.count ?? 0)

    // Opportunistic cleanup of expired buckets keeps the table small.
    if (count % 20 === 0) {
      await turso.execute({
        sql: 'DELETE FROM rate_limits WHERE expires_at < ?',
        args: [now],
      })
    }

    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt }
  } catch (err) {
    console.error('[rate-limit] datastore error — failing open:', err)
    return { allowed: true, remaining: limit, resetAt }
  }
}
