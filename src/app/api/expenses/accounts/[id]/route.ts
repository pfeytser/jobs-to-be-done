import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import {
  getEmailAccountById,
  setEmailAccountActive,
  deleteEmailAccount,
} from '@/lib/db/email-accounts'
import { decryptToken } from '@/lib/expenses/crypto'
import { revokeRefreshToken } from '@/lib/expenses/google-oauth'

async function guard() {
  const session = await auth()
  if (!session?.user) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!isExpenseOwner(session.user.email)) {
    return { ok: false as const, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { ok: true as const }
}

// Toggle active.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard()
  if (!g.ok) return g.res
  try {
    const { id } = await params
    const body = (await req.json()) as { is_active?: boolean }
    await setEmailAccountActive(id, !!body.is_active)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[expenses/accounts PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Disconnect: revoke the refresh token (best-effort), then delete the row.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard()
  if (!g.ok) return g.res
  try {
    const { id } = await params
    const account = await getEmailAccountById(id)
    if (account?.oauth_token_reference) {
      try {
        await revokeRefreshToken(decryptToken(account.oauth_token_reference))
      } catch {
        // proceed with delete regardless
      }
    }
    await deleteEmailAccount(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[expenses/accounts DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
