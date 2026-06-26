'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface SampleRow {
  rowNumber: number
  expense_date: string | null
  merchant: string
  category: string
  amount_usd: number | null
  receipt_amount_original: number | null
  report_name: string
  report_number: string
  errors: string[]
}

interface FilePreview {
  fileName: string
  error?: string
  totalRows?: number
  validRows?: number
  errorRows?: number
  missingRequiredColumns?: string[]
  recognisedColumns?: { field: string; label: string; column: string }[]
  unmappedColumns?: string[]
  sample?: SampleRow[]
  sampleTruncated?: boolean
}

interface ImportSummary {
  rowsProcessed: number
  rowsInserted: number
  rowsUpdated: number
  rowsSkipped: number
  errors: { file: string; row: number; messages: string[] }[]
}

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function ImportClient() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<FilePreview[] | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadPreview(selected: File[]) {
    setError(null)
    setSummary(null)
    setPreviews(null)
    setFiles(selected)
    if (selected.length === 0) return
    setLoading(true)
    try {
      const fd = new FormData()
      selected.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/expenses/preview', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Preview failed')
      setPreviews(data.files)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  async function runImport() {
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/expenses/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setSummary(data.summary)
      setPreviews(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setFiles([])
    setPreviews(null)
    setSummary(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const totalValid = previews?.reduce((s, p) => s + (p.validRows ?? 0), 0) ?? 0
  const totalError = previews?.reduce((s, p) => s + (p.errorRows ?? 0), 0) ?? 0

  // ── Import summary view ──
  if (summary) {
    return (
      <div className="space-y-4">
        <div className="bg-surface border border-line rounded-md p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Import complete</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Processed" value={summary.rowsProcessed} />
            <Stat label="Inserted" value={summary.rowsInserted} tone="pass" />
            <Stat label="Updated" value={summary.rowsUpdated} tone="info" />
            <Stat label="Skipped" value={summary.rowsSkipped} tone={summary.rowsSkipped ? 'warn' : undefined} />
          </div>
          {summary.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-ink-soft mb-2">
                {summary.errors.length} row{summary.errors.length !== 1 ? 's' : ''} skipped due to validation errors
              </p>
              <div className="max-h-60 overflow-y-auto border border-line rounded-sm divide-y divide-line">
                {summary.errors.slice(0, 100).map((e, i) => (
                  <div key={i} className="px-3 py-2 text-xs">
                    <span className="text-ink-muted">{e.file} · row {e.row}:</span>{' '}
                    <span className="text-fail">{e.messages.join('; ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/expenses"
            className="px-4 py-2 text-sm font-semibold bg-ink text-white rounded-sm hover:opacity-90 transition-opacity"
          >
            View transactions
          </Link>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-canvas border border-line text-ink rounded-sm hover:border-ink transition-colors"
          >
            Import more
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!previews && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const dropped = Array.from(e.dataTransfer.files)
            if (dropped.length) loadPreview(dropped)
          }}
          onClick={() => !loading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-md p-10 text-center transition-colors ${
            loading
              ? 'border-ink bg-canvas cursor-default'
              : dragOver
              ? 'border-ink bg-info cursor-pointer'
              : 'border-line hover:border-ink-muted cursor-pointer'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) loadPreview(f) }}
            className="hidden"
          />
          {loading ? (
            <>
              <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-ink" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm font-medium text-ink">Parsing…</p>
            </>
          ) : (
            <>
              <div className="text-3xl mb-2">🧾</div>
              <p className="text-sm font-medium text-ink mb-1">Drop Coupa CSV file(s) here or click to browse</p>
              <p className="text-xs text-ink-muted">CSV only · Max 5MB each · Multiple files allowed</p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-fail-soft border border-fail-line rounded-sm text-fail text-sm">
          {error}
        </div>
      )}

      {/* Preview */}
      {previews && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">{totalValid}</span> rows ready to import
              {totalError > 0 && (
                <span className="text-fail"> · {totalError} will be skipped</span>
              )}
            </p>
            <button onClick={reset} className="text-xs text-ink-muted hover:text-ink transition-colors">
              Choose different files
            </button>
          </div>

          {previews.map((p) => (
            <div key={p.fileName} className="bg-surface border border-line rounded-md p-4">
              <div className="flex items-center gap-2 mb-3">
                <span>🧾</span>
                <span className="text-sm font-medium text-ink">{p.fileName}</span>
                {p.error ? (
                  <span className="text-xs text-fail ml-auto">{p.error}</span>
                ) : (
                  <span className="text-xs text-ink-muted ml-auto">
                    {p.totalRows} row{p.totalRows !== 1 ? 's' : ''} · {p.validRows} valid
                    {(p.errorRows ?? 0) > 0 && ` · ${p.errorRows} with errors`}
                  </span>
                )}
              </div>

              {!p.error && (
                <>
                  {(p.missingRequiredColumns?.length ?? 0) > 0 && (
                    <div className="p-2.5 mb-3 bg-fail-soft border border-fail-line rounded-xs text-xs text-fail">
                      Missing required column{p.missingRequiredColumns!.length > 1 ? 's' : ''}:{' '}
                      {p.missingRequiredColumns!.join(', ')}. These rows cannot be imported.
                    </div>
                  )}

                  {/* Recognised columns */}
                  {(p.recognisedColumns?.length ?? 0) > 0 && (
                    <details className="group mb-3">
                      <summary className="text-xs text-ink-muted cursor-pointer hover:text-ink select-none list-none flex items-center gap-1">
                        <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                        {p.recognisedColumns!.length} column{p.recognisedColumns!.length !== 1 ? 's' : ''} recognised
                        {(p.unmappedColumns?.length ?? 0) > 0 && `, ${p.unmappedColumns!.length} ignored`}
                      </summary>
                      <div className="mt-2 p-2.5 bg-canvas border border-line rounded-xs grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {p.recognisedColumns!.map((c) => (
                          <div key={c.field} className="flex items-center gap-1.5 text-xs">
                            <span className="text-pass">✓</span>
                            <span className="font-mono text-ink truncate">{c.column}</span>
                            <span className="text-ink-muted">→</span>
                            <span className="text-ink-soft truncate">{c.label}</span>
                          </div>
                        ))}
                        {p.unmappedColumns!.map((c) => (
                          <div key={c} className="flex items-center gap-1.5 text-xs">
                            <span className="text-ink-muted">–</span>
                            <span className="font-mono text-ink-muted truncate">{c}</span>
                            <span className="text-[10px] text-ink-muted">(ignored)</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Sample rows */}
                  {(p.sample?.length ?? 0) > 0 && (
                    <div className="overflow-x-auto border border-line rounded-sm">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-canvas text-left border-b border-line">
                            <th className="px-2 py-1.5 font-semibold text-ink-soft">Date</th>
                            <th className="px-2 py-1.5 font-semibold text-ink-soft">Merchant</th>
                            <th className="px-2 py-1.5 font-semibold text-ink-soft">Category</th>
                            <th className="px-2 py-1.5 font-semibold text-ink-soft text-right">Amount</th>
                            <th className="px-2 py-1.5 font-semibold text-ink-soft text-right">Receipt Amt</th>
                            <th className="px-2 py-1.5 font-semibold text-ink-soft">Report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.sample!.map((r) => (
                            <tr
                              key={r.rowNumber}
                              className={`border-b border-line last:border-0 ${r.errors.length ? 'bg-fail-soft/40' : ''}`}
                            >
                              <td className="px-2 py-1.5 whitespace-nowrap text-ink">{r.expense_date ?? '—'}</td>
                              <td className="px-2 py-1.5 text-ink">
                                {r.merchant || '—'}
                                {r.errors.length > 0 && (
                                  <span className="block text-[10px] text-fail">{r.errors.join('; ')}</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-ink-soft">{r.category || '—'}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-ink">{money(r.amount_usd)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-ink font-medium">{money(r.receipt_amount_original)}</td>
                              <td className="px-2 py-1.5 text-ink-soft">{r.report_name || r.report_number || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {p.sampleTruncated && (
                        <div className="px-2 py-1.5 text-[10px] text-ink-muted bg-canvas border-t border-line">
                          Showing first {p.sample!.length} rows. All valid rows will be imported.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <button
              onClick={runImport}
              disabled={loading || totalValid === 0}
              className="px-5 py-2.5 text-sm font-semibold bg-ink text-white rounded-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Importing…' : `Import ${totalValid} row${totalValid !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={reset}
              className="px-4 py-2.5 text-sm font-medium bg-canvas border border-line text-ink rounded-sm hover:border-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'pass' | 'info' | 'warn' }) {
  const toneClass =
    tone === 'pass' ? 'text-pass' : tone === 'warn' ? 'text-blocked' : 'text-ink'
  return (
    <div className="bg-canvas border border-line rounded-sm p-3 text-center">
      <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-xs text-ink-muted mt-0.5">{label}</p>
    </div>
  )
}
