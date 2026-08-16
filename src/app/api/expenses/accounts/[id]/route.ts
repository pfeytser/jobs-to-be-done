import { NextRequest, NextResponse } from 'next/server'
import { requireExpenseOwner, route } from '@/lib/auth/guards'
import {
  getEmailAccountById,
  setEmailAccountActive,
  deleteEmailAccount,
} from '@/lib/db/email-accounts'
import { decryptToken } from '@/lib/expenses/crypto'
import { revokeRefreshToken } from '@/lib/expenses/google-oauth'

// Toggle active.
export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireExpenseOwner()

  const { id } = await params
  const body = (await req.json()) as { is_active?: boolean }
  await setEmailAccountActive(id, !!body.is_active)
  return NextResponse.json({ ok: true })
})

// Disconnect: revoke the refresh token (best-effort), then delete the row.
export const DELETE = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireExpenseOwner()

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
})
