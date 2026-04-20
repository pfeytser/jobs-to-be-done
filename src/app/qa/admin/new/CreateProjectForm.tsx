'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PLATFORMS = ['Web', 'Mobile App'] as const
const VIEWPORTS = ['Desktop', 'Tablet', 'Mobile']

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
  }
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
              selected.includes(opt)
                ? 'bg-ink text-white border-ink'
                : 'bg-canvas border-warm-border text-ink hover:border-ink-2'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CreateProjectForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState<'Web' | 'Mobile App'>('Web')
  const [viewports, setViewports] = useState<string[]>([])
  const [userTypes, setUserTypes] = useState<string[]>([])
  const [newUserType, setNewUserType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addUserType() {
    const val = newUserType.trim()
    if (val && !userTypes.includes(val)) {
      setUserTypes((prev) => [...prev, val])
    }
    setNewUserType('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/qa/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          platform,
          viewports,
          operating_systems: [],
          browsers: [],
          user_types: userTypes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create project')
      router.push(`/qa/admin/${data.project.slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Project name <span className="text-status-fail-text">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Members Portal QA — Q2 2026"
          required
          className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what this project covers…"
          rows={3}
          className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Platform</label>
        <div className="flex gap-2 flex-wrap">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setPlatform(p); if (p === 'Mobile App') setViewports([]) }}
              className={`px-4 py-2 text-sm font-medium rounded-full border transition-all ${
                platform === p
                  ? 'bg-ink text-white border-ink'
                  : 'bg-canvas border-warm-border text-ink hover:border-ink-2'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {platform === 'Web' && (
        <MultiSelect
          label="Viewports to test"
          options={VIEWPORTS}
          selected={viewports}
          onChange={setViewports}
        />
      )}

      {/* User types */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">User types</label>
        <p className="text-xs text-ink-3 mb-2">
          Add the membership or user types testers will choose from when starting a session.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newUserType}
            onChange={(e) => setNewUserType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUserType() } }}
            placeholder="e.g. Dedicated Office Member"
            className="flex-1 px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
          />
          <button
            type="button"
            onClick={addUserType}
            className="px-4 py-2.5 bg-canvas border border-warm-border text-sm font-medium text-ink rounded-[10px] hover:border-ink transition-colors"
          >
            Add
          </button>
        </div>
        {userTypes.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {userTypes.map((ut) => (
              <span
                key={ut}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-warm-border text-sm text-ink rounded-full"
              >
                {ut}
                <button
                  type="button"
                  onClick={() => setUserTypes((prev) => prev.filter((u) => u !== ut))}
                  className="text-ink-3 hover:text-ink transition-colors"
                  aria-label={`Remove ${ut}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-status-fail border border-status-fail-border rounded-[10px] text-status-fail-text text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2.5 bg-canvas border border-warm-border text-ink-2 text-sm font-medium rounded-full hover:border-ink hover:text-ink transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || submitting}
          className="px-6 py-2.5 bg-ink text-white text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating…
            </>
          ) : (
            'Create project'
          )}
        </button>
      </div>
    </form>
  )
}
