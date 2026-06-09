import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { scanFlights } from '@/lib/expenses/flights-scan'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Scans both connected inboxes for airline emails over a date range and rebuilds
// trips. Defaults to the past year (Jun 2025 → Jun 2026). Runs locally for speed.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { after?: string; before?: string }
    const afterIso = /^\d{4}-\d{2}-\d{2}$/.test(body.after ?? '') ? body.after! : '2025-06-01'
    const beforeIso = /^\d{4}-\d{2}-\d{2}$/.test(body.before ?? '') ? body.before! : '2026-07-01'

    const logs: string[] = []
    const summary = await scanFlights({
      afterIso,
      beforeIso,
      messagesPerQuery: 50,
      log: (m) => {
        if (logs.length < 500) logs.push(m)
      },
    })
    return NextResponse.json({ summary, logs: logs.slice(-100) })
  } catch (error) {
    console.error('[expenses/flights/scan POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    )
  }
}
