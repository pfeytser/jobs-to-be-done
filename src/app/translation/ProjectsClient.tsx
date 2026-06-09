'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TranslationProject } from '@/lib/translation/types'

export function ProjectsClient({
  initialProjects,
  isOwner,
}: {
  initialProjects: TranslationProject[]
  isOwner: boolean
}) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  async function createProject() {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/translation/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not create project')
      setProjects((p) => [...p, data.project])
      setNewName('')
      setCreating(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function rename(id: string) {
    const name = renameValue.trim()
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch(`/api/translation/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Rename failed')
      setProjects((p) => p.map((proj) => (proj.id === id ? { ...proj, name } : proj)))
      setRenamingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete project "${name}" and all its loaded sources and edits? This cannot be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/translation/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setProjects((p) => p.filter((proj) => proj.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <div>
          <Link href="/" className="text-sm text-ink-3 hover:text-ink transition-colors">
            ← Home
          </Link>
          <h1 className="text-2xl font-bold text-ink mt-2">Translation Review</h1>
          <p className="text-sm text-ink-3 mt-1">
            Review and correct localizations, then export production-safe files.
          </p>
        </div>
        {isOwner && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="shrink-0 px-4 py-2 text-sm font-medium bg-ink text-white rounded-[12px] hover:opacity-90 transition-opacity"
          >
            + New project
          </button>
        )}
      </div>

      {error && <p className="text-sm text-status-fail-text mt-3">{error}</p>}

      {creating && (
        <div className="mt-4 flex gap-2 items-center bg-surface border border-warm-border rounded-[12px] p-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createProject()}
            placeholder="Project name"
            className="flex-1 px-3 py-2 text-sm border border-warm-border rounded-[10px] bg-canvas focus:outline-none focus:border-ink"
          />
          <button
            onClick={createProject}
            disabled={busy}
            className="px-3 py-2 text-sm font-medium bg-ink text-white rounded-[10px] disabled:opacity-50"
          >
            Create
          </button>
          <button
            onClick={() => {
              setCreating(false)
              setNewName('')
            }}
            className="px-3 py-2 text-sm text-ink-3 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {projects.length === 0 && (
          <p className="text-sm text-ink-3">No projects yet.</p>
        )}
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="flex items-center justify-between bg-surface border border-warm-border rounded-[16px] p-5 hover:border-ink transition-colors group"
          >
            {renamingId === proj.id ? (
              <div className="flex-1 flex gap-2 items-center">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && rename(proj.id)}
                  className="flex-1 px-3 py-1.5 text-sm border border-warm-border rounded-[10px] bg-canvas focus:outline-none focus:border-ink"
                />
                <button onClick={() => rename(proj.id)} disabled={busy} className="px-3 py-1.5 text-sm font-medium bg-ink text-white rounded-[10px] disabled:opacity-50">
                  Save
                </button>
                <button onClick={() => setRenamingId(null)} className="px-3 py-1.5 text-sm text-ink-3 hover:text-ink">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <Link href={`/translation/${proj.id}`} className="flex-1">
                  <p className="text-base font-semibold text-ink">{proj.name}</p>
                  <p className="text-sm text-ink-3 mt-0.5">Open editor →</p>
                </Link>
                {isOwner && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setRenamingId(proj.id)
                        setRenameValue(proj.name)
                      }}
                      className="px-3 py-1.5 text-xs text-ink-2 hover:text-ink border border-warm-border rounded-[8px]"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => remove(proj.id, proj.name)}
                      className="px-3 py-1.5 text-xs text-status-fail-text hover:opacity-80 border border-warm-border rounded-[8px]"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
