'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { TranslationProject } from '@/lib/translation/types'
import { ConfirmDialog } from '@/components/ui'

// Owner-only project management: create / rename / delete, and a link into each
// project's source setup. Translators never see this surface.
export function AdminClient({ initialProjects }: { initialProjects: TranslationProject[] }) {
  const [projects, setProjects] = useState(initialProjects)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

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

  async function remove(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/translation/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setProjects((p) => p.filter((proj) => proj.id !== id))
      setPendingDelete(null)
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
          <Link href="/translation" className="text-sm text-ink-muted hover:text-ink transition-colors">
            ← Back to projects
          </Link>
          <h1 className="font-display tracking-tight text-2xl font-bold text-ink mt-2">Setup &amp; projects</h1>
          <p className="text-sm text-ink-muted mt-1">Create projects and load source files. Translators only see the editor.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="shrink-0 px-4 py-2 text-sm font-medium bg-ink text-white rounded-md hover:opacity-90 transition-opacity"
          >
            + New project
          </button>
        )}
      </div>

      {error && <p className="text-sm text-fail mt-3">{error}</p>}

      {creating && (
        <div className="mt-4 flex gap-2 items-center bg-surface border border-line rounded-md p-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createProject()}
            placeholder="Project name"
            className="flex-1 px-3 py-2 text-sm border border-line rounded-sm bg-canvas focus:outline-none focus:border-ink"
          />
          <button onClick={createProject} disabled={busy} className="px-3 py-2 text-sm font-medium bg-ink text-white rounded-sm disabled:opacity-50">
            Create
          </button>
          <button
            onClick={() => {
              setCreating(false)
              setNewName('')
            }}
            className="px-3 py-2 text-sm text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {projects.length === 0 && <p className="text-sm text-ink-muted">No projects yet.</p>}
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="flex items-center justify-between bg-surface border border-line rounded-lg p-5 group"
          >
            {renamingId === proj.id ? (
              <div className="flex-1 flex gap-2 items-center">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && rename(proj.id)}
                  className="flex-1 px-3 py-1.5 text-sm border border-line rounded-sm bg-canvas focus:outline-none focus:border-ink"
                />
                <button onClick={() => rename(proj.id)} disabled={busy} className="px-3 py-1.5 text-sm font-medium bg-ink text-white rounded-sm disabled:opacity-50">
                  Save
                </button>
                <button onClick={() => setRenamingId(null)} className="px-3 py-1.5 text-sm text-ink-muted hover:text-ink">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <Link href={`/translation/admin/${proj.id}`} className="flex-1">
                  <p className="text-base font-semibold text-ink">{proj.name}</p>
                  <p className="text-sm text-ink-muted mt-0.5">Manage sources →</p>
                </Link>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setRenamingId(proj.id)
                      setRenameValue(proj.name)
                    }}
                    className="px-3 py-1.5 text-xs text-ink-soft hover:text-ink border border-line rounded-xs"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => setPendingDelete({ id: proj.id, name: proj.name })}
                    className="px-3 py-1.5 text-xs text-fail hover:opacity-80 border border-line rounded-xs"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete.id)}
        title={pendingDelete ? `Delete “${pendingDelete.name}”?` : ''}
        danger
        confirmLabel="Delete"
        loading={busy}
      >
        This deletes the project and all its loaded sources and edits. This can’t be undone.
      </ConfirmDialog>
    </div>
  )
}
