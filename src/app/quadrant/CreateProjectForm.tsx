'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateProjectForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/quadrant/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Could not create project')
      }
      const { project } = await res.json()
      router.push(`/quadrant/${project.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create project')
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
      >
        + New project
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="p-4 bg-surface border border-line rounded-lg space-y-3">
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">Project name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={200}
          placeholder="Q3 feature prioritization"
          className="w-full px-3 py-2 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
        />
        <p className="text-xs text-ink-muted mt-1">You&apos;ll add themes and can tune the axis labels next.</p>
      </div>
      {error && <p className="text-sm text-fail">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {busy ? 'Creating…' : 'Create & add themes'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
