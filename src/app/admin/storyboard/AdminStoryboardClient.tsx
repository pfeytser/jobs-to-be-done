'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AdminNav } from '@/components/AdminNav'

type UseCaseStatus = 'draft' | 'create' | 'present' | 'archive'

interface UseCase {
  id: string
  name: string
  description: string
  status: UseCaseStatus
  created_at: string
}

const STATUS_LABELS: Record<UseCaseStatus, string> = {
  draft: 'Draft',
  create: 'Create',
  present: 'Present',
  archive: 'Archive',
}

const STATUS_COLORS: Record<UseCaseStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  create: 'bg-blue-100 text-blue-800',
  present: 'bg-green-100 text-green-800',
  archive: 'bg-gray-100 text-gray-500',
}

const STATUS_ORDER: UseCaseStatus[] = ['draft', 'create', 'present', 'archive']

export default function AdminStoryboardPage() {
  const [useCases, setUseCases] = useState<UseCase[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchUseCases()
  }, [])

  async function fetchUseCases() {
    setLoading(true)
    try {
      const res = await fetch('/api/storyboard/use-cases')
      const data = await res.json()
      setUseCases(data.useCases ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/storyboard/use-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      })
      if (res.ok) {
        setNewName('')
        setNewDesc('')
        setShowForm(false)
        await fetchUseCases()
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleStatusChange(id: string, status: UseCaseStatus) {
    setSaving(id)
    try {
      await fetch(`/api/storyboard/use-cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setUseCases((prev) => prev.map((uc) => uc.id === id ? { ...uc, status } : uc))
    } finally {
      setSaving(null)
    }
  }

  async function handleNameDescSave(id: string, name: string, description: string) {
    setSaving(id)
    try {
      await fetch(`/api/storyboard/use-cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-warm-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-ink-3 hover:text-ink transition-colors text-sm">
              ← Admin
            </Link>
            <span className="text-ink-3">/</span>
            <span className="font-semibold text-ink">Storyboard</span>
          </div>
          <AdminNav role="admin" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-ink">Storyboard Use Cases</h1>
            <p className="text-sm text-ink-3 mt-1">Create and manage use cases for collaborator storyboards.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-ink text-white text-sm font-medium rounded-lg hover:opacity-80 transition-opacity"
          >
            + New use case
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-8 p-5 bg-surface border border-warm-border rounded-[14px] space-y-4"
          >
            <h2 className="text-base font-semibold text-ink">New use case</h2>
            <div>
              <label className="block text-xs font-medium text-ink-3 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-warm-border rounded-lg text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
                placeholder="e.g. Event planning onboarding"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-3 mb-1">Description</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-warm-border rounded-lg text-sm text-ink bg-canvas focus:outline-none focus:border-ink resize-none"
                placeholder="Describe the use case scenario..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 bg-ink text-white text-sm font-medium rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setNewName(''); setNewDesc('') }}
                className="px-4 py-2 text-sm text-ink-3 hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-sm text-ink-3 py-12 text-center">Loading…</div>
        ) : useCases.length === 0 ? (
          <div className="text-sm text-ink-3 py-12 text-center">No use cases yet. Create one above.</div>
        ) : (
          <div className="space-y-3">
            {useCases.map((uc) => (
              <UseCaseRow
                key={uc.id}
                useCase={uc}
                saving={saving === uc.id}
                onStatusChange={(status) => handleStatusChange(uc.id, status)}
                onSave={(name, desc) => handleNameDescSave(uc.id, name, desc)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function UseCaseRow({
  useCase,
  saving,
  onStatusChange,
  onSave,
}: {
  useCase: UseCase
  saving: boolean
  onStatusChange: (status: UseCaseStatus) => void
  onSave: (name: string, description: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(useCase.name)
  const [description, setDescription] = useState(useCase.description)

  return (
    <div className="bg-surface border border-warm-border rounded-[14px] overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{useCase.name}</p>
          {useCase.description && (
            <p className="text-xs text-ink-3 mt-0.5 truncate">{useCase.description}</p>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[useCase.status]}`}>
          {STATUS_LABELS[useCase.status]}
        </span>
        <svg
          className={`w-4 h-4 text-ink-3 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-warm-border pt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => onSave(name, description)}
              className="w-full px-3 py-2 border border-warm-border rounded-lg text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => onSave(name, description)}
              rows={3}
              className="w-full px-3 py-2 border border-warm-border rounded-lg text-sm text-ink bg-canvas focus:outline-none focus:border-ink resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  disabled={saving}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                    useCase.status === s
                      ? 'bg-ink text-white border-ink'
                      : 'bg-canvas text-ink-3 border-warm-border hover:border-ink hover:text-ink'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          {saving && <p className="text-xs text-ink-3">Saving…</p>}
        </div>
      )}
    </div>
  )
}
