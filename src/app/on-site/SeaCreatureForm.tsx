'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SeaCreatureForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [creature, setCreature] = useState('')
  const [why, setWhy] = useState('')
  const [saving, setSaving] = useState(false)

  // userId is passed for context but all auth is server-side
  void userId

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!creature.trim()) return
    setSaving(true)

    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sea_creature: creature.trim(), sea_creature_why: why.trim() }),
      })

      // Fire avatar generation silently in background — no await, no feedback
      fetch('/api/profile/generate-avatar', { method: 'POST' }).catch(() => {})

      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sea_creature_skipped: true }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">Before we begin…</h1>
        <p className="text-sm text-ink-3">Let&apos;s get your profile up to date.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="p-5 bg-surface border border-warm-border rounded-[16px] space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              If you could be any sea creature, what sea creature would you be?
            </label>
            <input
              type="text"
              value={creature}
              onChange={(e) => setCreature(e.target.value)}
              className="w-full px-3 py-2.5 border border-warm-border rounded-lg text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
              placeholder="e.g. octopus, dolphin, manta ray…"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">Why?</label>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-warm-border rounded-lg text-sm text-ink bg-canvas focus:outline-none focus:border-ink resize-none"
              placeholder="What draws you to this creature?"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !creature.trim()}
            className="flex-1 py-2.5 bg-ink text-white text-sm font-medium rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="px-4 py-2.5 text-sm text-ink-3 hover:text-ink transition-colors disabled:opacity-40"
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  )
}
