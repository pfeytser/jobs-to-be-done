'use client'

import { useState } from 'react'

interface Storyboard {
  id: string
  customer_name: string
  customer_demographics: string
  company_type: string
  customer_role: string
}

interface Card {
  id: string
  scene_description: string
  sort_order: number
  image_url: string | null
}

interface UseCase {
  id: string
  name: string
  description: string
}

export default function StoryboardEditor({
  useCase,
  initialStoryboard,
  initialCards,
}: {
  useCase: UseCase
  initialStoryboard: Storyboard | null
  initialCards: Card[]
}) {
  const [storyboard, setStoryboard] = useState<Storyboard>(
    initialStoryboard ?? {
      id: '',
      customer_name: '',
      customer_demographics: '',
      company_type: '',
      customer_role: '',
    }
  )
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [profileSaved, setProfileSaved] = useState(!!initialStoryboard?.id)
  const [savingProfile, setSavingProfile] = useState(false)
  const [addingCard, setAddingCard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveProfile() {
    setSavingProfile(true)
    setError(null)
    try {
      const res = await fetch(`/api/storyboard/use-cases/${useCase.id}/board`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: storyboard.customer_name,
          customer_demographics: storyboard.customer_demographics,
          company_type: storyboard.company_type,
          customer_role: storyboard.customer_role,
        }),
      })
      if (res.status === 403) {
        setError('This storyboard is now in presentation mode.')
        return
      }
      if (!res.ok) { setError('Failed to save. Please try again.'); return }
      const data = await res.json()
      setStoryboard(data.storyboard)
      setProfileSaved(true)
    } finally {
      setSavingProfile(false)
    }
  }

  async function addCard() {
    if (!profileSaved) return
    setAddingCard(true)
    try {
      const res = await fetch(`/api/storyboard/use-cases/${useCase.id}/cards`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      setCards((prev) => [...prev, data.card])
    } finally {
      setAddingCard(false)
    }
  }

  async function moveCard(cardId: string, direction: 'up' | 'down') {
    const idx = cards.findIndex((c) => c.id === cardId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= cards.length) return

    const newCards = [...cards]
    const tempOrder = newCards[idx].sort_order
    newCards[idx] = { ...newCards[idx], sort_order: newCards[swapIdx].sort_order }
    newCards[swapIdx] = { ...newCards[swapIdx], sort_order: tempOrder }
    newCards.sort((a, b) => a.sort_order - b.sort_order)
    setCards(newCards)

    // Persist both sort orders
    await Promise.all([
      fetch(`/api/storyboard/use-cases/${useCase.id}/cards/${newCards[idx].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: newCards[idx].sort_order }),
      }),
      fetch(`/api/storyboard/use-cases/${useCase.id}/cards/${newCards[swapIdx].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: newCards[swapIdx].sort_order }),
      }),
    ])
  }

  async function deleteCard(cardId: string) {
    setCards((prev) => prev.filter((c) => c.id !== cardId))
    await fetch(`/api/storyboard/use-cases/${useCase.id}/cards/${cardId}`, { method: 'DELETE' })
  }

  function updateCardLocally(cardId: string, description: string) {
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, scene_description: description } : c))
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-10">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Use case context */}
      <section>
        <h1 className="text-2xl font-bold text-ink mb-2">{useCase.name}</h1>
        {useCase.description && (
          <p className="text-sm text-ink-3 leading-relaxed">{useCase.description}</p>
        )}
      </section>

      {/* Customer profile */}
      <section>
        <h2 className="text-lg font-bold text-ink mb-1">Customer Profile</h2>
        <p className="text-sm text-ink-3 mb-5">Who is the customer in this storyboard?</p>

        <div className="space-y-4 p-5 bg-surface border border-warm-border rounded-[14px]">
          <Field
            label="Customer name"
            value={storyboard.customer_name}
            onChange={(v) => setStoryboard((s) => ({ ...s, customer_name: v }))}
            placeholder="e.g. Maria Chen"
          />
          <Field
            label="Demographic description"
            value={storyboard.customer_demographics}
            onChange={(v) => setStoryboard((s) => ({ ...s, customer_demographics: v }))}
            placeholder="e.g. Mid-career professional, 35, urban, tech-comfortable"
            multiline
          />
          <Field
            label="Company description"
            value={storyboard.company_type}
            onChange={(v) => setStoryboard((s) => ({ ...s, company_type: v }))}
            placeholder="e.g. Mid-size events management company"
          />
          <Field
            label="Their role"
            value={storyboard.customer_role}
            onChange={(v) => setStoryboard((s) => ({ ...s, customer_role: v }))}
            placeholder="e.g. Operations Director"
          />

          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="w-full py-2.5 bg-ink text-white text-sm font-medium rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {savingProfile ? 'Saving…' : profileSaved ? 'Save changes' : 'Save & continue'}
          </button>
        </div>
      </section>

      {/* Cards */}
      {profileSaved && (
        <section>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-ink">Storyboard Scenes</h2>
            <p className="text-sm text-ink-3 mt-0.5">Add scenes in chronological order.</p>
          </div>

          {cards.length === 0 ? (
            <div className="text-sm text-ink-3 py-10 text-center border border-dashed border-warm-border rounded-[14px]">
              No scenes yet. Add your first scene below.
            </div>
          ) : (
            <div className="space-y-3">
              {cards.map((card, idx) => (
                <SceneCard
                  key={card.id}
                  card={card}
                  index={idx}
                  total={cards.length}
                  useCaseId={useCase.id}
                  onMove={(dir) => moveCard(card.id, dir)}
                  onDelete={() => deleteCard(card.id)}
                  onDescriptionChange={(desc) => updateCardLocally(card.id, desc)}
                />
              ))}
            </div>
          )}

          <button
            onClick={addCard}
            disabled={addingCard}
            className="mt-4 w-full py-2.5 border-2 border-dashed border-warm-border text-sm font-medium text-ink-3 rounded-[14px] hover:border-ink hover:text-ink transition-colors disabled:opacity-40"
          >
            {addingCard ? 'Adding…' : '+ Add scene'}
          </button>
        </section>
      )}
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-3 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full px-3 py-2 border border-warm-border rounded-lg text-sm text-ink bg-canvas focus:outline-none focus:border-ink resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-warm-border rounded-lg text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
        />
      )}
    </div>
  )
}

function SceneCard({
  card,
  index,
  total,
  useCaseId,
  onMove,
  onDelete,
  onDescriptionChange,
}: {
  card: Card
  index: number
  total: number
  useCaseId: string
  onMove: (dir: 'up' | 'down') => void
  onDelete: () => void
  onDescriptionChange: (desc: string) => void
}) {
  const [description, setDescription] = useState(card.scene_description)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  async function handleBlur() {
    onDescriptionChange(description)
    setSaving(true)
    setSaveError(false)
    try {
      const res = await fetch(`/api/storyboard/use-cases/${useCaseId}/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene_description: description }),
      })
      if (!res.ok) {
        // Retry once
        const retry = await fetch(`/api/storyboard/use-cases/${useCaseId}/cards/${card.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scene_description: description }),
        })
        if (!retry.ok) setSaveError(true)
      }
      // Image generation is triggered server-side on every save — no client timer needed
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface border border-warm-border rounded-[14px] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-3 uppercase tracking-widest">
          Scene {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="p-1 text-ink-3 hover:text-ink transition-colors disabled:opacity-30"
            title="Move up"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === total - 1}
            className="p-1 text-ink-3 hover:text-ink transition-colors disabled:opacity-30"
            title="Move down"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-ink-3 hover:text-red-500 transition-colors ml-1"
            title="Delete scene"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={handleBlur}
        rows={4}
        placeholder="Describe what is happening in this scene…"
        className="w-full px-3 py-2 border border-warm-border rounded-lg text-sm text-ink bg-canvas focus:outline-none focus:border-ink resize-none"
      />

      {saving && <p className="text-xs text-ink-3">Saving…</p>}
      {saveError && <p className="text-xs text-red-500">Failed to save. Please try again.</p>}
    </div>
  )
}
