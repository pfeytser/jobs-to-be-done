'use client'

import { useState, useRef } from 'react'

interface UploadedItem {
  tc_number: string
  part: string
  section: string
  feature_area: string
  platform: string
  viewport: string
  user_type: string
  test_description: string
  steps: string
  expected_result: string
  jira_reference: string
  needs_review: boolean
}

interface ValidationResult {
  warnings: string[]
  info: string[]
  recognisedColumns: { field: string; column: string }[]
  unmappedColumns: string[]
}

interface UploadPanelProps {
  projectId: string
  userType: string
  onItemsReady: (items: UploadedItem[]) => void
}

export function UploadPanel({ projectId, userType, onItemsReady }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [parsedItems, setParsedItems] = useState<UploadedItem[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(f: File) {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.csv')) {
      setError('Only CSV files are supported.')
      return
    }
    setError(null)
    setValidation(null)
    setParsedItems(null)
    setFile(f)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('user_type', userType)
      const res = await fetch(`/api/qa/projects/${projectId}/upload`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      if (!data.items?.length) throw new Error('No test items found in this CSV. Check that the file has recognisable columns.')

      setValidation(data.validation ?? null)

      if ((data.validation?.warnings?.length ?? 0) > 0) {
        // Hold items — require admin to acknowledge warnings first
        setParsedItems(data.items)
      } else {
        // No warnings — proceed immediately
        onItemsReady(data.items)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setFile(null)
    } finally {
      setUploading(false)
    }
  }

  function handleConfirm() {
    if (parsedItems) onItemsReady(parsedItems)
  }

  function handleReset() {
    setFile(null)
    setValidation(null)
    setParsedItems(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const hasWarnings = (validation?.warnings?.length ?? 0) > 0
  const hasInfo = (validation?.info?.length ?? 0) > 0

  return (
    <div className="space-y-3">
      {/* Drop zone — hidden once we have a result to review */}
      {!validation && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-[12px] p-8 text-center transition-colors ${
            uploading
              ? 'border-ink bg-canvas cursor-default'
              : dragOver
              ? 'border-ink bg-mist cursor-pointer'
              : 'border-warm-border hover:border-ink-3 cursor-pointer'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            className="hidden"
          />
          {uploading ? (
            <>
              <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-ink" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm font-medium text-ink mb-1">Reading {file?.name}…</p>
              <p className="text-xs text-ink-3">Parsing test items</p>
            </>
          ) : (
            <>
              <div className="text-2xl mb-2">📋</div>
              <p className="text-sm font-medium text-ink mb-1">Drop a CSV here or click to browse</p>
              <p className="text-xs text-ink-3">CSV only · Max 5MB · Uploads automatically</p>
            </>
          )}
        </div>
      )}

      {/* Validation panel — shown after a successful parse */}
      {validation && (
        <div className="space-y-3">
          {/* File summary row */}
          <div className="flex items-center justify-between p-3 bg-surface border border-warm-border rounded-[10px]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm">📋</span>
              <span className="text-sm font-medium text-ink truncate">{file?.name}</span>
              <span className="text-xs text-ink-3 shrink-0">· {parsedItems?.length ?? 0} items</span>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-ink-3 hover:text-ink transition-colors shrink-0 ml-3"
            >
              Upload different file
            </button>
          </div>

          {/* Warnings — blocks auto-proceed, requires confirmation */}
          {hasWarnings && (
            <div className="p-3 bg-status-blocked border border-status-blocked-border rounded-[10px] space-y-2">
              <p className="text-xs font-semibold text-status-blocked-text">⚠️ Issues that may affect testers</p>
              <ul className="space-y-1">
                {validation.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-status-blocked-text leading-relaxed">• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Info — purely informational */}
          {hasInfo && (
            <div className="p-3 bg-surface border border-warm-border rounded-[10px] space-y-1.5">
              <p className="text-xs font-semibold text-ink-2">ℹ️ Notes</p>
              <ul className="space-y-1">
                {validation.info.map((msg, i) => (
                  <li key={i} className="text-xs text-ink-3 leading-relaxed">• {msg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Column mapping — collapsible */}
          {validation.recognisedColumns.length > 0 && (
            <details className="group">
              <summary className="text-xs text-ink-3 cursor-pointer hover:text-ink transition-colors select-none list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                {validation.recognisedColumns.length} column{validation.recognisedColumns.length !== 1 ? 's' : ''} recognised
                {validation.unmappedColumns.length > 0 && (
                  <span className="text-ink-3">, {validation.unmappedColumns.length} ignored</span>
                )}
              </summary>
              <div className="mt-2 p-3 bg-canvas border border-warm-border rounded-[8px] space-y-1">
                {validation.recognisedColumns.map(({ field, column }) => (
                  <div key={field} className="flex items-center gap-1.5 text-xs">
                    <span className="text-status-pass-text shrink-0">✓</span>
                    <span className="font-mono text-ink">{column}</span>
                    <span className="text-ink-3">→</span>
                    <span className="text-ink-2">{field}</span>
                  </div>
                ))}
                {validation.unmappedColumns.map((col) => (
                  <div key={col} className="flex items-center gap-1.5 text-xs">
                    <span className="text-ink-3 shrink-0">–</span>
                    <span className="font-mono text-ink-3">{col}</span>
                    <span className="text-[10px] text-ink-3">(ignored)</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Confirm button — only shown when warnings need acknowledgement */}
          {hasWarnings && parsedItems && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleReset}
                className="px-3 py-2 text-sm font-medium bg-canvas border border-warm-border text-ink-3 rounded-[8px] hover:border-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-semibold bg-ink text-white rounded-[8px] hover:opacity-90 transition-opacity"
              >
                Import anyway ({parsedItems.length} items)
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-status-fail border border-status-fail-border rounded-[10px] text-status-fail-text text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
