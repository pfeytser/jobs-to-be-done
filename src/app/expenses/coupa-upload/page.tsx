import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { isExpenseOwner } from '@/lib/expenses/access'
import { listCoupaUploadItems, listExpenses, type CoupaUploadItem } from '@/lib/db/expenses'

export const dynamic = 'force-dynamic'

function money(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default async function CoupaUploadPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (!isExpenseOwner(session.user.email)) redirect('/')

  const [items, pending] = await Promise.all([
    listCoupaUploadItems(),
    listExpenses({ match_status: 'possible_match' }),
  ])

  // Group by Coupa report.
  const byReport = new Map<string, { name: string; items: CoupaUploadItem[] }>()
  for (const it of items) {
    const key = it.report_number || '(no report)'
    if (!byReport.has(key)) byReport.set(key, { name: it.report_name, items: [] })
    byReport.get(key)!.items.push(it)
  }
  const reports = [...byReport.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/expenses" className="text-sm text-ink-muted hover:text-ink transition-colors">
          ← Back to transactions
        </Link>
        <div className="flex items-start justify-between gap-3 mt-3 mb-1">
          <h1 className="text-2xl font-bold text-ink">Coupa upload worklist</h1>
          {items.length > 0 && (
            <a
              href="/api/expenses/coupa-upload/export"
              className="px-4 py-2 text-sm font-semibold bg-ink text-white rounded-sm hover:opacity-90 transition-opacity shrink-0"
            >
              Download all receipts (ZIP)
            </a>
          )}
        </div>
        <p className="text-sm text-ink-muted mb-6">
          {items.length} confirmed receipt{items.length !== 1 ? 's' : ''} across {reports.length} report
          {reports.length !== 1 ? 's' : ''}, ready to attach in Coupa.
          {pending.length > 0 && (
            <>
              {' '}
              <span className="text-blocked">
                {pending.length} more {pending.length === 1 ? 'is' : 'are'} awaiting review
              </span>{' '}
              — confirm {pending.length === 1 ? 'it' : 'them'} on the{' '}
              <Link href="/expenses" className="text-ink underline">transactions page</Link> to include here.
            </>
          )}
        </p>

        {reports.length === 0 ? (
          <div className="bg-surface border border-line rounded-md p-8 text-center text-sm text-ink-muted">
            No confirmed receipts yet. Match and approve receipts first, then they’ll appear here grouped by report.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(([reportNumber, { name, items: lines }]) => (
              <div key={reportNumber} className="bg-surface border border-line rounded-md p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">
                      Report {reportNumber}
                      {name && <span className="text-ink-muted font-normal"> · {name}</span>}
                    </h2>
                    <p className="text-xs text-ink-muted">{lines.length} receipt{lines.length !== 1 ? 's' : ''}</p>
                  </div>
                  <a
                    href={`/api/expenses/coupa-upload/export?report=${encodeURIComponent(reportNumber)}`}
                    className="px-3 py-1.5 text-xs font-semibold bg-surface border border-line text-ink rounded-xs hover:border-ink transition-colors shrink-0"
                  >
                    Download ZIP
                  </a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-line text-ink-soft">
                        <th className="py-1.5 pr-3 font-semibold">Date</th>
                        <th className="py-1.5 pr-3 font-semibold">Merchant</th>
                        <th className="py-1.5 pr-3 font-semibold text-right">Amount</th>
                        <th className="py-1.5 pr-3 font-semibold">Receipt file</th>
                        <th className="py-1.5 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((it) => (
                        <tr key={it.expense_id} className="border-b border-line last:border-0">
                          <td className="py-1.5 pr-3 whitespace-nowrap text-ink">{it.expense_date ?? '—'}</td>
                          <td className="py-1.5 pr-3 text-ink">{it.merchant || '—'}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-ink whitespace-nowrap">
                            {money(it.amount_usd)}
                            {it.receipt_amount_original != null && (
                              <span className="text-ink-muted"> · {money(it.receipt_amount_original)}</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-[11px] text-ink-soft">{it.suggested_filename}</td>
                          <td className="py-1.5 whitespace-nowrap">
                            <a
                              href={`/api/expenses/receipt-file/${it.receipt_file_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-ink hover:underline"
                            >
                              View ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
