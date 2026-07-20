import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'

// Centralized, fail-closed authorization helpers. Prefer these over hand-written
// `auth()` + role checks in every route: the guard throws when access is denied,
// so a route that forgets to authorize simply won't return data. Pair with
// `route()` below so thrown errors become clean HTTP responses.
//
// Usage:
//   export const POST = route(async (req, ctx) => {
//     const user = await requireAdmin()
//     ...
//   })

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

type SessionUser = Session['user']

/** Authenticated user, or throws 401. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth()
  if (!session?.user) throw new HttpError(401, 'Unauthorized')
  return session.user
}

/** Authenticated admin, or throws 401/403. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'admin') throw new HttpError(403, 'Forbidden')
  return user
}

/** Authenticated Expense Reports owner, or throws 401/403. */
export async function requireExpenseOwner(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isExpenseOwner(user.email)) throw new HttpError(403, 'Forbidden')
  return user
}

/**
 * Wrap a route handler so HttpError becomes a JSON error response and any
 * unexpected error becomes a generic 500 (never leaks internals to the client).
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      console.error('[route] unhandled error:', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
