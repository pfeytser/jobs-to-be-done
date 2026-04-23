'use client'

import { useState, useEffect } from 'react'

interface FailModalProps {
  sessionId: string
  projectId: string
  testItemId: string
  testDescription: string
  existingResult?: {
    steps_taken?: string | null
    expected_behavior?: string | null
    actual_behavior?: string | null
    test_username?: string | null
    screenshot_url?: string | null
    screenshot_filename?: string | null
  } | null
  previousUsernames: string[]
  onClose: () => void
  onSaved: () => void
}

export function FailModal({
  sessionId,
  testItemId,
  testDescription,
  existingResult,
  previousUsernames,
  onClose,
  onSaved,
}: FailModalProps) {
  const [stepsTaken, setStepsTaken] = useState(existingResult?.steps_taken ?? '')
  const [expectedBehavior, setExpectedBehavior] = useState(existingResult?.expected_behavior ?? '')
  const [actualBehavior, setActualBehavior] = useState(existingResult?.actual_behavior ?? '')
  const [testUsername, setTestUsername] = useState(existingResult?.test_username ?? '')
  const [customUsername, setCustomUsername] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [existingScreenshot, setExistingScreenshot] = useState(existingResult?.screenshot_filename ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const allUsernames = ['Not signed in', ...previousUsernames]

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const finalUsername = showCustomInput ? customUsername : testUsername

      // Upload screenshot first if provided
      let screenshotFilename = existingScreenshot
      let screenshotUrl: string | null = existingResult?.screenshot_url ?? null
      if (screenshotFile) {
        setUploading(true)
        const fd = new FormData()
        fd.append('file', screenshotFile)
        fd.append('test_item_id', testItemId)
        const res = await fetch(`/api/qa/sessions/${sessionId}/screenshot`, { method: 'POST', body: fd })
        setUploading(false)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Screenshot upload failed')
        }
        const data = await res.json()
        screenshotFilename = data.filename
        screenshotUrl = data.url
      }

      const res = await fetch(`/api/qa/sessions/${sessionId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_item_id: testItemId,
          status: 'fail',
          steps_taken: stepsTaken || null,
          expected_behavior: expectedBehavior || null,
          actual_behavior: actualBehavior || null,
          test_username: finalUsername || null,
          screenshot_filename: screenshotFilename,
          screenshot_url: screenshotUrl,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to save')
      }

      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto"
      style={{ backgroundColor: 'rgba(17,34,32,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-surface rounded-[14px] border border-warm-border w-full max-w-lg shadow-xl mb-8"
        style={{ boxShadow: '0 8px 32px rgba(17,34,32,0.18)' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-warm-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-status-fail-text bg-status-fail border border-status-fail-border px-2 py-0.5 rounded-full">
                  ❌ Fail
                </span>
              </div>
              <p className="text-sm font-medium text-ink leading-snug mt-2">{testDescription}</p>
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
          <p className="text-xs text-ink-3 mt-2">All fields are optional. Fill in as much as you can.</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              What were you doing when this happened?
            </label>
            <textarea
              value={stepsTaken}
              onChange={(e) => setStepsTaken(e.target.value)}
              placeholder="Describe the steps you took before the issue appeared…"
              className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              What did you expect to happen?
            </label>
            <textarea
              value={expectedBehavior}
              onChange={(e) => setExpectedBehavior(e.target.value)}
              placeholder="Describe what should have happened…"
              className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              What actually happened? Feel free to add any extra detail that might help.
            </label>
            <textarea
              value={actualBehavior}
              onChange={(e) => setActualBehavior(e.target.value)}
              placeholder="Describe what went wrong, including any error messages you saw…"
              className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink placeholder:text-ink-3 bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Username or email used for testing
            </label>
            {!showCustomInput ? (
              <div className="flex gap-2">
                <select
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                >
                  <option value="">Select or type a username…</option>
                  {allUsernames.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="px-3 py-2.5 bg-canvas border border-warm-border text-xs text-ink-2 rounded-[10px] hover:border-ink hover:text-ink transition-all whitespace-nowrap"
                >
                  + New
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  placeholder="Type a username or email…"
                  className="flex-1 px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => { setShowCustomInput(false); setCustomUsername('') }}
                  className="px-3 py-2.5 bg-canvas border border-warm-border text-xs text-ink-2 rounded-[10px] hover:border-ink hover:text-ink transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Screenshot */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Screenshot <span className="text-ink-3 font-normal">(optional)</span>
            </label>
            {existingScreenshot && !screenshotFile && (
              <p className="text-xs text-ink-2 mb-2">
                Current: <span className="font-mono">{existingScreenshot}</span>
              </p>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-2 file:mr-3 file:py-2 file:px-3 file:rounded-[8px] file:border file:border-warm-border file:text-sm file:font-medium file:text-ink file:bg-canvas hover:file:bg-mist transition-all"
            />
            {screenshotFile && (
              <p className="text-xs text-ink-3 mt-1">{screenshotFile.name}</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-status-fail border border-status-fail-border rounded-[10px] text-status-fail-text text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
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
              disabled={saving || uploading}
              className="px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
            >
              {(saving || uploading) ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {uploading ? 'Uploading…' : 'Saving…'}
                </>
              ) : (
                'Save failure report'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
