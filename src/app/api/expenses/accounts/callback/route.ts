import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { exchangeCodeForTokens } from '@/lib/expenses/google-oauth'
import { encryptToken } from '@/lib/expenses/crypto'
import { upsertEmailAccount } from '@/lib/db/email-accounts'

function back(req: NextRequest, status: string) {
  const url = new URL('/expenses/accounts', req.url)
  url.searchParams.set('connect', status)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sp = req.nextUrl.searchParams
  const code = sp.get('code')
  const stateRaw = sp.get('state')
  const error = sp.get('error')
  if (error) return back(req, `error:${error}`)
  if (!code || !stateRaw) return back(req, 'error:missing_code')

  // CSRF check
  let label = 'work'
  try {
    const state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf-8')) as {
      label?: string
      nonce?: string
    }
    const cookieNonce = req.cookies.get('rcpt_oauth_nonce')?.value
    if (!state.nonce || state.nonce !== cookieNonce) return back(req, 'error:state_mismatch')
    if (state.label) label = state.label
  } catch {
    return back(req, 'error:bad_state')
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refreshToken) {
      // Google only returns a refresh token with prompt=consent + access_type=offline.
      return back(req, 'error:no_refresh_token')
    }
    if (!tokens.emailAddress) return back(req, 'error:no_email')

    await upsertEmailAccount({
      account_label: label,
      email_address: tokens.emailAddress,
      oauth_token_reference: encryptToken(tokens.refreshToken),
      token_scope: tokens.scope,
    })

    const res = back(req, 'success')
    res.cookies.delete('rcpt_oauth_nonce')
    return res
  } catch (e) {
    console.error('[expenses/accounts/callback]', e instanceof Error ? e.message : e)
    return back(req, 'error:exchange_failed')
  }
}
