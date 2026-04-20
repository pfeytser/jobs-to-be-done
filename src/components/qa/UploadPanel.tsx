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

  async function handleFile(f: File) {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.csv')) {
      setError('Only CSV files are supported.')
      return
    }
    setError(null)
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
      if (!data.items?.length) throw new Error('No test items found in this CSV. Check that the file has the expected columns.')
      onItemsReady(data.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setFile(null)
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
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-[12px] p-8 text-center transition-colors ${
          uploading ? 'border-ink bg-canvas cursor-default' : dragOver ? 'border-ink bg-mist cursor-pointer' : 'border-warm-border hover:border-ink-3 cursor-pointer'
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

      {error && (
        <div className="p-3 bg-status-fail border border-status-fail-border rounded-[10px] text-status-fail-text text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
