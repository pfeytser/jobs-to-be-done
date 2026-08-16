import { NextRequest, NextResponse } from 'next/server'
import { requireExpenseOwner, route } from '@/lib/auth/guards'
import { countExpensesToSearch } from '@/lib/db/expenses'
import { runMatching, DEFAULT_CONFIG } from '@/lib/expenses/engine'
import { DEFAULT_SKIP_RULES } from '@/lib/expenses/scoring'

// Allow long runs on platforms that honor it (Vercel Pro caps at 300s). Locally
// there's no timeout, so a full batch completes regardless.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Triggers a matching run from the UI. Processes one batch (default 25) so the
// request stays responsive; the client can re-run until `remaining` hits 0.
//
// NOTE: full receipt capture (rendering receipt emails to PDF) needs Playwright,
// which only runs when the app runs locally. On serverless, email-body PDFs are
// skipped gracefully (attachments + matches still work).
export const POST = route(async (req: NextRequest) => {
  await requireExpenseOwner()

  try {
    const body = (await req.json().catch(() => ({}))) as { max?: number; dryRun?: boolean }
    const max = Math.min(Math.max(1, Number(body.max) || 25), 200)

    const logs: string[] = []
    const summary = await runMatching({
      ...DEFAULT_CONFIG,
      maxExpensesPerRun: max,
      dryRun: !!body.dryRun,
      skipRules: DEFAULT_SKIP_RULES,
      log: (msg) => {
        if (logs.length < 500) logs.push(msg)
      },
    })

    const remaining = await countExpensesToSearch()
    return NextResponse.json({ summary, remaining, logs: logs.slice(-100) })
  } catch (error) {
    console.error('[expenses/match/run POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Run failed' },
      { status: 500 }
    )
  }
})
