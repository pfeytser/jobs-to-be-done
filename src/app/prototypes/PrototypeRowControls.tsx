'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui'

type Status = 'active' | 'archived'

export function PrototypeRowControls({ id, name, status }: { id: string; name: string; status: Status }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [nameValue, setNameValue] = useState(name)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function run(fn: () => Promise<Response>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Action failed.')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  async function saveRename() {
    if (!nameValue.trim() || nameValue === name) { setRenaming(false); setNameValue(name); return }
    await run(() =>
      fetch(`/api/prototypes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue.trim() }),
      })
    )
    setRenaming(false)
  }

  function toggleArchive() {
    run(() =>
      fetch(`/api/prototypes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status === 'active' ? 'archived' : 'active' }),
      })
    )
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    await run(() => fetch(`/api/prototypes/${id}/file`, { method: 'POST', body: formData }))
  }

  const remove = async () => {
    await run(() => fetch(`/api/prototypes/${id}`, { method: 'DELETE' }))
    setConfirmOpen(false)
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      {renaming ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setRenaming(false); setNameValue(name) } }}
            className="px-2 py-1 border border-line rounded-sm text-xs text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <button onClick={saveRename} disabled={busy} className="px-2 py-1 bg-ink text-white text-xs font-medium rounded-xs hover:opacity-90 disabled:opacity-50">
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => setRenaming(true)}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium bg-canvas border border-line text-ink rounded-xs hover:border-ink transition-colors disabled:opacity-50"
          >
            Rename
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium bg-canvas border border-line text-ink rounded-xs hover:border-ink transition-colors disabled:opacity-50"
          >
            Replace file
          </button>
          <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleFileChange} className="hidden" />
          <button
            onClick={toggleArchive}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium border border-line text-ink-soft rounded-full hover:border-ink transition-colors disabled:opacity-50"
          >
            {status === 'active' ? 'Archive' : 'Unarchive'}
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium text-fail rounded-full hover:bg-fail-soft transition-colors disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}
      {error && <span className="text-xs text-fail text-right">{error}</span>}
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
        title={`Delete "${name}"?`}
        danger
        confirmLabel="Delete"
        loading={busy}
      >
        This removes the file and can’t be undone.
      </ConfirmDialog>
    </div>
  )
}
