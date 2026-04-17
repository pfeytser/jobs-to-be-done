'use client'

import { useState, useEffect } from 'react'

interface BlockedModalProps {
  sessionId: string
  testItemId: string
  testDescription: string
  existingNote?: string | null
  onClose: () => void
  onSaved: () => void
}

export function BlockedModal({
  sessionId,
  testItemId,
  testDescription,
  existingNote,
  onClose,
  onSaved,
}: BlockedModalProps) {
  const [note, setNote] = useState(existingNote ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/qa/sessions/${sessionId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_item_id: testItemId,
          status: 'blocked',
          blocked_note: note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to save')
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(17,34,32,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-surface rounded-[14px] border border-warm-border w-full max-w-md shadow-xl"
        style={{ boxShadow: '0 8px 32px rgba(17,34,32,0.18)' }}
      >
        <div className="px-6 pt-6 pb-4 border-b border-warm-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-status-blocked-text bg-status-blocked border border-status-blocked-border px-2 py-0.5 rounded-full">
                  🚧 Blocked
                </span>
              </div>
              <p className="text-sm font-medium text-ink leading-snug">{testDescription}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 text-ink-3 hover:text-ink transition-colors rounded-lg hover:bg-canvas"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              What&apos;s preventing you from testing this right now?{' '}
              <span className="text-ink-3 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. The feature isn't loading, or I don't have access to the right account type…"
              className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
              rows={3}
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-status-fail border border-status-fail-border rounded-[10px] text-status-fail-text text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-canvas border border-warm-border text-ink-2 text-sm font-medium rounded-full hover:border-ink hover:text-ink transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                'Mark as blocked'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
