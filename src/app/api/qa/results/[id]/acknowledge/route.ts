import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { acknowledgeResult } from '@/lib/db/qa-results'

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAdmin()

  const { id } = await params
  await acknowledgeResult(id, user.userId)
  return NextResponse.json({ ok: true })
})
