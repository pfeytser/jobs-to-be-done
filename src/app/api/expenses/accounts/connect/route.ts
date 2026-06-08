import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { buildConsentUrl } from '@/lib/expenses/google-oauth'
import { randomBytes } from 'crypto'

// Kicks off the Gmail consent flow. Owner-only. Carries the account label + a CSRF
// nonce (also set as an httpOnly cookie) through `state`.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const label = (req.nextUrl.searchParams.get('label') ?? 'work').slice(0, 32)
  const nonce = randomBytes(16).toString('hex')
  const state = Buffer.from(JSON.stringify({ label, nonce })).toString('base64url')

  let consentUrl: string
  try {
    consentUrl = buildConsentUrl(state)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gmail connect not configured' },
      { status: 500 }
    )
  }

  const res = NextResponse.redirect(consentUrl)
  res.cookies.set('rcpt_oauth_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
