'use client'

import { useRef, useState } from 'react'
import type { DatasetMeta, UiDatasetConfig, CsvDatasetConfig } from '@/lib/translation/types'

interface CsvDetect {
  fileName: string
  text: string
  headers: string[]
  rowCount: number
  englishColumn: string
  langColumns: Record<string, string> // header -> selected (we key by header)
  labelColumns: string[]
}

export function SourcesPanel({
  projectId,
  datasets,
  onChanged,
}: {
  projectId: string
  datasets: DatasetMeta[]
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const [enFile, setEnFile] = useState<File | null>(null)
  const [targetFiles, setTargetFiles] = useState<File[]>([])
  const [csvDetect, setCsvDetect] = useState<CsvDetect | null>(null)

  async function loadUi() {
    if (!enFile || targetFiles.length === 0) {
      setError('Choose an English file and at least one target file.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const english = { fileName: enFile.name, text: await enFile.text() }
      const targets = await Promise.all(targetFiles.map(async (f) => ({ fileName: f.name, text: await f.text() })))
      const res = await fetch(`/api/translation/projects/${projectId}/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'ui', english, targets }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not load UI dictionary')
      setEnFile(null)
      setTargetFiles([])
      if (enRef.current) enRef.current.value = ''
      if (targetRef.current) targetRef.current.value = ''
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function detectCsv(file: File) {
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      const res = await fetch('/api/translation/detect-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read CSV')
      const suggested = data.suggested as CsvDatasetConfig
      setCsvDetect({
        fileName: file.name,
        text,
        headers: data.headers,
        rowCount: data.rowCount,
        englishColumn: suggested.englishColumn,
        langColumns: { ...suggested.langColumns },
        labelColumns: [...suggested.labelColumns],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmCsv() {
    if (!csvDetect) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/translation/projects/${projectId}/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'csv',
          fileName: csvDetect.fileName,
          text: csvDetect.text,
          config: {
            englishColumn: csvDetect.englishColumn,
            langColumns: csvDetect.langColumns,
            labelColumns: csvDetect.labelColumns,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not load CSV')
      setCsvDetect(null)
      if (csvRef.current) csvRef.current.value = ''
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function removeDataset(id: string, name: string) {
    if (!confirm(`Remove source "${name}"? Edits for its strings will be deleted.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/translation/projects/${projectId}/datasets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  // Toggle a header in/out of the language columns map.
  function toggleLang(header: string) {
    setCsvDetect((d) => {
      if (!d) return d
      const next = { ...d.langColumns }
      if (next[header]) delete next[header]
      else next[header] = header
      return { ...d, langColumns: next }
    })
  }

  function toggleLabel(header: string) {
    setCsvDetect((d) => {
      if (!d) return d
      const has = d.labelColumns.includes(header)
      return {
        ...d,
        labelColumns: has ? d.labelColumns.filter((h) => h !== header) : [...d.labelColumns, header],
      }
    })
  }

  return (
    <div className="mb-6">
      <div className="grid md:grid-cols-2 gap-4">
        {/* UI dictionary card */}
        <div className="bg-surface border border-line rounded-lg p-5">
          <h3 className="text-sm font-semibold text-ink">UI dictionary (JSON)</h3>
          <p className="text-xs text-ink-muted mt-1">
            Translators only edit the translation. Keys, structure, and placeholders are locked; exports match{' '}
            <code className="font-mono">en.json</code> exactly.
          </p>
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-medium text-ink-soft">English source</label>
            <input
              ref={enRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => setEnFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-ink-soft file:mr-3 file:py-1.5 file:px-3 file:rounded-xs file:border file:border-line file:bg-canvas file:text-ink-soft file:text-xs"
            />
            <label className="block text-xs font-medium text-ink-soft mt-2">Target language files</label>
            <input
              ref={targetRef}
              type="file"
              accept=".json,application/json"
              multiple
              onChange={(e) => setTargetFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-xs text-ink-soft file:mr-3 file:py-1.5 file:px-3 file:rounded-xs file:border file:border-line file:bg-canvas file:text-ink-soft file:text-xs"
            />
            {targetFiles.length > 0 && (
              <p className="text-[11px] text-ink-muted">
                {targetFiles.map((f) => f.name.replace(/\.json$/i, '')).join(', ')}
              </p>
            )}
            <button
              onClick={loadUi}
              disabled={busy}
              className="mt-2 px-3 py-1.5 text-sm font-medium bg-ink text-white rounded-sm disabled:opacity-50"
            >
              Load dictionary
            </button>
          </div>
        </div>

        {/* CSV card */}
        <div className="bg-surface border border-line rounded-lg p-5">
          <h3 className="text-sm font-semibold text-ink">Database export (CSV)</h3>
          <p className="text-xs text-ink-muted mt-1">
            One column is English; one column per language. Id/path columns are preserved untouched on export.
          </p>
          <div className="mt-3">
            <input
              ref={csvRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) detectCsv(f)
              }}
              className="block w-full text-xs text-ink-soft file:mr-3 file:py-1.5 file:px-3 file:rounded-xs file:border file:border-line file:bg-canvas file:text-ink-soft file:text-xs"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-fail mt-3">{error}</p>}

      {/* Loaded sources */}
      {datasets.length > 0 && (
        <div className="mt-4 space-y-2">
          {datasets.map((d) => {
            const langs =
              d.kind === 'ui'
                ? Object.keys((d.config as UiDatasetConfig).targets)
                : Object.keys((d.config as CsvDatasetConfig).langColumns)
            const mismatches = d.kind === 'ui' ? (d.config as UiDatasetConfig).mismatches : undefined
            return (
              <div key={d.id} className="flex items-start justify-between bg-surface border border-line rounded-md px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {d.name} <span className="text-xs text-ink-muted">({d.kind === 'ui' ? 'UI JSON' : 'CSV'})</span>
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">{langs.join(', ') || 'no languages detected'}</p>
                  {mismatches && Object.keys(mismatches).length > 0 && (
                    <p className="text-[11px] text-blocked mt-1">
                      ⚠ Structural mismatch:{' '}
                      {Object.entries(mismatches)
                        .map(
                          ([lang, m]) =>
                            `${lang} (${m.missingInTarget.length} missing, ${m.extraInTarget.length} extra)`,
                        )
                        .join('; ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeDataset(d.id, d.name)}
                  className="shrink-0 ml-3 text-xs text-fail hover:opacity-80 border border-line rounded-xs px-2.5 py-1"
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* CSV column-mapping dialog */}
      {csvDetect && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setCsvDetect(null)}>
          <div className="bg-surface rounded-lg p-6 max-w-lg w-full max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-ink">Map columns — {csvDetect.fileName}</h3>
            <p className="text-xs text-ink-muted mt-1">{csvDetect.rowCount.toLocaleString()} rows. Confirm which columns hold copy.</p>

            <label className="block text-xs font-medium text-ink-soft mt-4">English column</label>
            <select
              value={csvDetect.englishColumn}
              onChange={(e) => setCsvDetect({ ...csvDetect, englishColumn: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-sm border border-line rounded-sm bg-canvas"
            >
              {csvDetect.headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>

            <p className="text-xs font-medium text-ink-soft mt-4">Language columns</p>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {csvDetect.headers
                .filter((h) => h !== csvDetect.englishColumn)
                .map((h) => (
                  <label key={h} className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <input type="checkbox" checked={!!csvDetect.langColumns[h]} onChange={() => toggleLang(h)} />
                    <span className="truncate">{h}</span>
                  </label>
                ))}
            </div>

            <p className="text-xs font-medium text-ink-soft mt-4">Label columns (shown to identify each row)</p>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {csvDetect.headers
                .filter((h) => h !== csvDetect.englishColumn && !csvDetect.langColumns[h])
                .map((h) => (
                  <label key={h} className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <input type="checkbox" checked={csvDetect.labelColumns.includes(h)} onChange={() => toggleLabel(h)} />
                    <span className="truncate">{h}</span>
                  </label>
                ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setCsvDetect(null)} className="px-3 py-1.5 text-sm text-ink-muted hover:text-ink">
                Cancel
              </button>
              <button
                onClick={confirmCsv}
                disabled={busy || Object.keys(csvDetect.langColumns).length === 0}
                className="px-4 py-1.5 text-sm font-medium bg-ink text-white rounded-sm disabled:opacity-50"
              >
                Add CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
