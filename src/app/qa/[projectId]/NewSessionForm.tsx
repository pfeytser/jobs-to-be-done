'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { QAProject } from '@/lib/db/qa-projects'

const VIEWPORTS = ['Desktop', 'Tablet', 'Mobile']
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge']

const OS_BY_VIEWPORT: Record<string, string[]> = {
  Desktop: ['Mac', 'Windows'],
  Tablet: ['iOS', 'Android', 'Windows'],
  Mobile: ['iOS', 'Android'],
}

export function NewSessionForm({ project }: { project: QAProject }) {
  const router = useRouter()
  const [userType, setUserType] = useState('')
  const [viewport, setViewport] = useState('')
  const [os, setOs] = useState('')
  const [browser, setBrowser] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableViewports =
    project.viewports.length > 0
      ? project.viewports.filter((v) => VIEWPORTS.includes(v))
      : VIEWPORTS

  const availableOs = viewport ? (OS_BY_VIEWPORT[viewport] ?? []) : []
  const availableBrowsers = BROWSERS

  const isValid = userType && viewport && os && browser

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/qa/projects/${project.id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_type: userType,
          viewport,
          operating_system: os,
          browser,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start session')
      router.push(`/qa/${project.slug}/session/${data.session.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* User type */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Which user type are you testing?
        </label>
        {project.user_types.length > 0 ? (
          <select
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
          >
            <option value="">Select a user type…</option>
            {project.user_types.map((ut) => (
              <option key={ut} value={ut}>{ut}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
            placeholder="e.g. Dedicated Office Member"
            required
            className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
          />
        )}
      </div>

      {/* Viewport */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Viewport</label>
        <div className="flex gap-2 flex-wrap">
          {availableViewports.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setViewport(v); setOs('') }}
              className={`px-4 py-2 text-sm font-medium rounded-full border transition-all ${
                viewport === v
                  ? 'bg-ink text-white border-ink'
                  : 'bg-canvas border-warm-border text-ink hover:border-ink-2'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* OS */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Operating system</label>
        {!viewport && <p className="text-xs text-ink-3 mb-2">Select a viewport first</p>}
        <div className="flex gap-2 flex-wrap">
          {availableOs.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOs(o)}
              className={`px-4 py-2 text-sm font-medium rounded-full border transition-all ${
                os === o
                  ? 'bg-ink text-white border-ink'
                  : 'bg-canvas border-warm-border text-ink hover:border-ink-2'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* Browser */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Browser</label>
        <div className="flex gap-2 flex-wrap">
          {availableBrowsers.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrowser(b)}
              className={`px-4 py-2 text-sm font-medium rounded-full border transition-all ${
                browser === b
                  ? 'bg-ink text-white border-ink'
                  : 'bg-canvas border-warm-border text-ink hover:border-ink-2'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-status-fail border border-status-fail-border rounded-[10px] text-status-fail-text text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || submitting}
        className="w-full py-3 bg-ink text-white text-sm font-semibold rounded-[10px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Starting…
          </>
        ) : (
          'Start QA session'
        )}
      </button>
    </form>
  )
}
