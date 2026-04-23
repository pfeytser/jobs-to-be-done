import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { acknowledgeResult } from '@/lib/db/qa-results'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  try {
    await acknowledgeResult(id, session.user.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[qa/results/acknowledge PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
