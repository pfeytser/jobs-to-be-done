import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'
import type { NextAuthRequest } from 'next-auth'

const PUBLIC_PATTERNS = [
  /^\/api\/auth\/.*/,
  /^\/api\/health$/,
  /^\/auth\/.*/,
]

const ADMIN_PATTERNS = [
  /^\/admin(\/.*)?$/,
  /^\/qa\/admin(\/.*)?$/,
  /^\/admin\/storyboard(\/.*)?$/,
]

export default auth(function middleware(req: NextAuthRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes
  for (const pattern of PUBLIC_PATTERNS) {
    if (pattern.test(pathname)) {
      return NextResponse.next()
    }
  }

  // Check authentication — always land on / after login so users see the feature picker
  const session = req.auth
  if (!session?.user) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', new URL('/', req.url).toString())
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

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
}
