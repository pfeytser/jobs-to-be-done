'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateWorkshopForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [topN, setTopN] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/workshop/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), topN }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Could not create workshop')
      }
      const { workshop } = await res.json()
      router.push(`/workshop/${workshop.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create workshop')
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
      >
        + New workshop
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="p-4 bg-surface border border-line rounded-lg space-y-3">
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">Workshop name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={200}
          placeholder="Q3 Priorities"
          className="w-full px-3 py-2 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">Description <span className="text-ink-muted font-normal">(optional)</span></label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          placeholder="What are we prioritizing and why?"
          className="w-full px-3 py-2 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink mb-1">Items advanced per category</label>
        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          className="px-3 py-2 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>Top {n} (ties may add more, up to 4)</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-fail">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {busy ? 'Creating…' : 'Create & add items'}
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
