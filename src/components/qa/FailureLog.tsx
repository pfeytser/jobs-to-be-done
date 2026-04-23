'use client'

import { useState } from 'react'

interface Failure {
  id: string
  test_description: string
  tester_name: string
  user_type: string
  session_viewport: string
  session_browser: string
  tc_number: string
  steps_taken: string | null
  actual_behavior: string | null
  test_username: string | null
  screenshot_filename: string | null
  screenshot_url: string | null
  recorded_at: string | null
}

export function FailureLog({ initialFailures }: { initialFailures: Failure[] }) {
  const [failures, setFailures] = useState(initialFailures)
  const [acknowledging, setAcknowledging] = useState<string | null>(null)

  async function handleAcknowledge(id: string) {
    setAcknowledging(id)
    try {
      const res = await fetch(`/api/qa/results/${id}/acknowledge`, { method: 'PATCH' })
      if (res.ok) {
        setFailures((prev) => prev.filter((f) => f.id !== id))
      }
    } finally {
      setAcknowledging(null)
    }
  }

  if (failures.length === 0) {
    return (
      <div className="bg-surface border border-warm-border rounded-[12px] p-6 text-center text-sm text-ink-3">
        No failures reported yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {failures.map((f) => (
        <div key={f.id} className="bg-surface border border-status-fail-border rounded-[12px] p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">{f.test_description}</p>
              <p className="text-xs text-ink-3 mt-0.5">
                {f.tester_name} · {f.user_type} · {f.session_viewport} · {f.session_browser}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {f.tc_number && (
                <span className="text-xs font-mono text-ink-3">{f.tc_number}</span>
              )}
              <button
                onClick={() => handleAcknowledge(f.id)}
                disabled={acknowledging === f.id}
                className="px-2.5 py-1 text-xs font-medium bg-canvas border border-warm-border text-ink-2 rounded-full hover:border-ink hover:text-ink transition-all disabled:opacity-50"
              >
                {acknowledging === f.id ? '…' : 'Acknowledge'}
              </button>
            </div>
          </div>
          {f.steps_taken && (
            <div className="mb-1.5">
              <span className="text-xs font-semibold text-ink-3">Steps taken: </span>
              <span className="text-xs text-ink-2">{f.steps_taken}</span>
            </div>
          )}
          {f.actual_behavior && (
            <div className="mb-1.5">
              <span className="text-xs font-semibold text-ink-3">What happened: </span>
              <span className="text-xs text-ink-2">{f.actual_behavior}</span>
            </div>
          )}
          {f.test_username && (
            <div className="mb-1.5">
              <span className="text-xs font-semibold text-ink-3">Username used: </span>
              <span className="text-xs font-mono text-ink-2">{f.test_username}</span>
            </div>
          )}
          {f.screenshot_filename && (
            <div className="mt-2">
              {f.screenshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={`/api/qa/blob-image?url=${encodeURIComponent(f.screenshot_url)}`} target="_blank" rel="noopener noreferrer">
                  <img
                    src={`/api/qa/blob-image?url=${encodeURIComponent(f.screenshot_url)}`}
                    alt={f.screenshot_filename}
                    className="max-h-32 rounded-[8px] border border-warm-border object-cover hover:opacity-80 transition-opacity"
                  />
                </a>
              ) : (
                <span className="text-xs font-mono text-ink-3">{f.screenshot_filename}</span>
              )}
            </div>
          )}
          <p className="text-xs text-ink-3 mt-2">
            {f.recorded_at ? new Date(f.recorded_at).toLocaleString() : ''}
          </p>
        </div>
      ))}
    </div>
  )
}
