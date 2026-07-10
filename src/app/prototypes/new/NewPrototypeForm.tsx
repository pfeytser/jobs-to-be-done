'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewPrototypeForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !file) return
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('file', file)
      const res = await fetch('/api/prototypes', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to upload prototype')
      router.push(`/prototypes/${data.prototype.slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Name <span className="text-fail">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Checkout redesign"
          required
          className="w-full px-3 py-2.5 border border-line rounded-sm text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
        />
        <p className="text-xs text-ink-muted mt-1.5">Used to generate the shareable URL slug.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          HTML file <span className="text-fail">*</span>
        </label>
        <input
          type="file"
          accept=".html,.htm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="w-full text-sm text-ink"
        />
      </div>

      {error && (
        <div className="p-3 bg-fail-soft border border-fail-line rounded-sm text-fail text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2.5 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-full hover:border-ink hover:text-ink transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || !file || submitting}
          className="px-6 py-2.5 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {submitting ? 'Uploading…' : 'Upload prototype'}
        </button>
      </div>
    </form>
  )
}
