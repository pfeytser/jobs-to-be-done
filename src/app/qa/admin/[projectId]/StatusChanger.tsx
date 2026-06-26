'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'complete', label: 'Complete' },
  { value: 'archived', label: 'Archived' },
]

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-canvas text-ink-muted border-line',
  active: 'bg-pass-soft text-pass border-pass-line',
  complete: 'bg-info text-ink-soft border-line',
  archived: 'bg-canvas text-ink-muted border-line opacity-60',
}

export function StatusChanger({
  projectId,
  currentStatus,
}: {
  projectId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)

  async function handleChange(newStatus: string) {
    if (newStatus === status) return
    setSaving(true)
    try {
      const res = await fetch(`/api/qa/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setStatus(newStatus)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleChange(opt.value)}
          disabled={saving}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all disabled:opacity-50 ${
            status === opt.value
              ? `${STATUS_STYLES[opt.value]} ring-2 ring-offset-1 ring-ink`
              : 'bg-canvas border-line text-ink-soft hover:border-ink-soft'
          }`}
        >
          {opt.label}
        </button>
      ))}
      {saving && (
        <svg className="w-4 h-4 animate-spin text-ink-muted" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
    </div>
  )
}
