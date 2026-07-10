import { timingSafeEqual } from 'crypto'

// Shared-secret bearer token for programmatic uploads (e.g. from a Claude Code
// session), scoped to the prototypes create/update endpoint only.
export function isValidApiToken(req: Request): boolean {
  const header = req.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer (.+)$/)
  const expected = process.env.PROTOTYPES_API_TOKEN
  if (!match || !expected) return false

  const provided = Buffer.from(match[1])
  const secret = Buffer.from(expected)
  if (provided.length !== secret.length) return false
  return timingSafeEqual(provided, secret)
}
