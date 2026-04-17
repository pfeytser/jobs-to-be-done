'use client'

import { useState, useRef } from 'react'

interface UploadedItem {
  tc_number: string
  part: string
  section: string
  feature_area: string
  platform: string
  user_type: string
  test_description: string
  steps: string
  expected_result: string
  jira_reference: string
  needs_review: boolean
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.csv')) {
      setError('Only CSV files are supported.')
      return
    }
    setError(null)
    setFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('user_type', userType)
      const res = await fetch(`/api/qa/projects/${projectId}/upload`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onItemsReady(data.items)
      setFile(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files[0]
          if (f) handleFile(f)
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-[12px] p-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-ink bg-mist' : 'border-warm-border hover:border-ink-3'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          className="hidden"
        />
        <div className="text-2xl mb-2">📋</div>
        <p className="text-sm font-medium text-ink mb-1">Drop a CSV here or click to browse</p>
        <p className="text-xs text-ink-3">CSV only · Max 5MB</p>
      </div>

      {file && (
        <div className="flex items-center justify-between px-3 py-2 bg-canvas border border-warm-border rounded-[8px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">📋</span>
            <span className="text-sm text-ink truncate">{file.name}</span>
            <span className="text-xs text-ink-3 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setFile(null) }}
            className="text-ink-3 hover:text-ink transition-colors ml-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-status-fail border border-status-fail-border rounded-[10px] text-status-fail-text text-sm">
          {error}
        </div>
      )}

      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full py-3 bg-ink text-white text-sm font-semibold rounded-[10px] hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Importing…
            </>
          ) : (
            'Import CSV'
          )}
        </button>
      )}
    </div>
  )
}
