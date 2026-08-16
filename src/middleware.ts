import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'
import type { NextAuthRequest } from 'next-auth'
import { isExpenseOwner } from '@/lib/expenses/access'

const PUBLIC_PATTERNS = [
  /^\/api\/auth\/.*/,
  /^\/api\/health$/,
  /^\/auth\/.*/,
]

const ADMIN_PATTERNS = [
  /^\/admin(\/.*)?$/,
  /^\/qa\/admin(\/.*)?$/,
  /^\/admin\/storyboard(\/.*)?$/,
  /^\/roadmap(\/.*)?$/,
]

// Private single-owner workspace — only the owner email may reach these routes.
const EXPENSE_OWNER_PATTERNS = [
  /^\/expenses(\/.*)?$/,
  /^\/api\/expenses(\/.*)?$/,
]

export default auth(function middleware(req: NextAuthRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes
  for (const pattern of PUBLIC_PATTERNS) {
    if (pattern.test(pathname)) {
      return NextResponse.next()
    }
  }

  // Check authentication — send unauthenticated users to sign-in, preserving the
  // originally requested path so a shared deep link survives login (the sign-in
  // page's safeCallbackUrl only accepts same-origin relative paths).
  const session = req.auth
  if (!session?.user) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(signInUrl)
  }

  // Check admin-only routes
  for (const pattern of ADMIN_PATTERNS) {
    if (pattern.test(pathname)) {
      const role = (session.user as { role?: string }).role
      if (role !== 'admin') {
        return NextResponse.redirect(new URL('/jtbd', req.url))
      }
    }
  }

  // Check owner-only Expense Reports routes
  for (const pattern of EXPENSE_OWNER_PATTERNS) {
    if (pattern.test(pathname)) {
      const email = (session.user as { email?: string | null }).email
      if (!isExpenseOwner(email)) {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
}
