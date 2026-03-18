'use client'

import { useState } from 'react'

interface JTBDCardProps {
  id: string
  situation: string
  motivation: string
  expectedOutcome: string
  fullSentence: string
  createdAt: string
  mode?: 'classic' | 'hiring'
  onDelete?: (id: string) => Promise<void>
  showDelete?: boolean
}

export function JTBDCard({
  id,
  situation,
  motivation,
  expectedOutcome,
  fullSentence,
  createdAt,
  mode = 'classic',
  onDelete,
  showDelete = false,
}: JTBDCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    if (!onDelete) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setDeleting(true)
    try {
      await onDelete(id)
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const date = new Date(createdAt)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-surface rounded-[14px] border border-warm-border p-5 group transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {mode === 'hiring' ? (
            <p className="text-sm text-ink leading-relaxed">
              <strong>I am hiring it to</strong> {situation}.
            </p>
          ) : (
            <p className="text-sm text-ink leading-relaxed">
              When <strong>{situation}</strong>,{' '}
              I want to <strong>{motivation}</strong>,{' '}
              so I can <strong>{expectedOutcome}</strong>.
            </p>
          )}
        </div>

        {showDelete && onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`shrink-0 p-2 rounded-lg transition-all ${
              confirmDelete
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'text-ink-3 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
            }`}
            title={confirmDelete ? 'Click again to confirm' : 'Delete'}
          >
            {deleting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        )}
      </div>

      {confirmDelete && (
        <div className="mt-3 text-xs text-red-600 font-medium text-right">
          Click trash again to confirm deletion
        </div>
      )}
    </div>
  )
}
