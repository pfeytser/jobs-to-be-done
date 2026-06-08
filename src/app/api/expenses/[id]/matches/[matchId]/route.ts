import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { getExpenseById, setExpenseMatchState } from '@/lib/db/expenses'
import { getMatchById, setMatchStatus, getMatchesForExpense } from '@/lib/db/receipts'

// Approve or reject a candidate match.
// Body: { action: 'approve' | 'reject' }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isExpenseOwner(session.user.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { id, matchId } = await params
    const { action } = (await req.json()) as { action?: string }
    const expense = await getExpenseById(id)
    const match = await getMatchById(matchId)
    if (!expense || !match || match.expense_transaction_id !== id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (action === 'approve') {
      await setMatchStatus(matchId, 'approved')
      await setExpenseMatchState(id, {
        match_status: 'matched',
        matched_receipt_file_id: match.receipt_file_id,
        confidence_score: match.confidence_score,
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'reject') {
      await setMatchStatus(matchId, 'rejected')
      // Recompute expense state from remaining (non-rejected) matches.
      const remaining = (await getMatchesForExpense(id)).filter(
        (m) => m.id !== matchId && m.match_status !== 'rejected'
      )
      const approved = remaining.find((m) => m.match_status === 'approved')
      const auto = remaining.find((m) => m.match_status === 'auto_matched')
      const review = remaining.find((m) => m.match_status === 'needs_review')
      if (approved || auto) {
        const w = (approved ?? auto)!
        await setExpenseMatchState(id, {
          match_status: 'matched',
          matched_receipt_file_id: w.receipt_file_id,
          confidence_score: w.confidence_score,
        })
      } else if (review) {
        await setExpenseMatchState(id, {
          match_status: 'possible_match',
          matched_receipt_file_id: null,
          confidence_score: review.confidence_score,
        })
      } else {
        await setExpenseMatchState(id, {
          match_status: 'unmatched',
          matched_receipt_file_id: null,
          confidence_score: null,
        })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[expenses/:id/matches/:matchId POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
