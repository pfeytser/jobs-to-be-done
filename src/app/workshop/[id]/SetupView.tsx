'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DraftItem {
  key: string
  id?: string
  category: string
  title: string
  description: string
}

function newKey() {
  return `k_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

const CSV_TEMPLATE =
  'category,title,description\r\n' +
  'Product,Faster search,"Users complain results are slow"\r\n' +
  'Product,Dark mode,Frequently requested by the team\r\n' +
  'Ops,Onboarding automation,Reduce manual steps for new hires\r\n'

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`

/**
 * Parses CSV text into item rows. Handles quoted fields (commas/newlines inside
 * quotes, "" escapes). Uses a header row to map columns when present; otherwise
 * assumes the order category, title, description. Rows missing a category or
 * title are dropped.
 */
function parseCsv(text: string): Array<{ category: string; title: string; description: string }> {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    if (row.some((v) => v.trim() !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      pushField()
    } else if (c === '\n') {
      pushRow()
    } else if (c === '\r') {
      if (text[i + 1] === '\n') i++
      pushRow()
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) pushRow()
  if (rows.length === 0) return []

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const hasHeader = header.includes('category') && header.includes('title')
  let catIdx = 0
  let titleIdx = 1
  let descIdx = 2
  let dataRows = rows
  if (hasHeader) {
    catIdx = header.indexOf('category')
    titleIdx = header.indexOf('title')
    descIdx = header.findIndex((h) => h === 'description' || h === 'desc')
    dataRows = rows.slice(1)
  }

  return dataRows
    .map((r) => ({
      category: (r[catIdx] ?? '').trim(),
      title: (r[titleIdx] ?? '').trim(),
      description: (descIdx >= 0 ? r[descIdx] ?? '' : '').trim(),
    }))
    .filter((r) => r.category && r.title)
}

export function SetupView({
  workshopId,
  name,
  description,
  initialItems,
  mode = 'draft',
}: {
  workshopId: string
  name: string
  description: string
  initialItems: Array<{ id?: string; category: string; title: string; description: string }>
  /** 'draft' = pre-activation setup; 'live' = facilitator editing during round 1. */
  mode?: 'draft' | 'live'
}) {
  const router = useRouter()
  const live = mode === 'live'
  const [items, setItems] = useState<DraftItem[]>(
    initialItems.map((it) => ({ key: newKey(), ...it }))
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function update(key: string, field: keyof DraftItem, value: string) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)))
    setSavedAt(null)
  }
  function remove(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key))
    setSavedAt(null)
  }
  function addRow() {
    setItems((prev) => [...prev, { key: newKey(), category: '', title: '', description: '' }])
    setSavedAt(null)
  }
  function clearAll() {
    setItems([])
    setSavedAt(null)
  }
  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-uploading the same filename
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseCsv(text).map((x) => ({ key: newKey(), ...x }))
      if (parsed.length === 0) {
        setError('No rows found. Expected columns: category, title, description.')
        return
      }
      // Uploading defines the item set; the rows stay fully editable below.
      setItems(parsed)
      setError(null)
      setSavedAt(null)
    } catch {
      setError('Could not read that file. Please upload a .csv file.')
    }
  }

  const clean = items.filter((it) => it.category.trim() && it.title.trim())
  const categories = Array.from(new Set(clean.map((it) => it.category.trim())))

  async function save(): Promise<boolean> {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/workshop/sessions/${workshopId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: clean.map((it) => ({
            ...(it.id ? { id: it.id } : {}),
            category: it.category.trim(),
            title: it.title.trim(),
            description: it.description.trim(),
          })),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Could not save')
      }
      const data = await res.json().catch(() => ({}))
      // Re-key from the server so newly-created items pick up their real ids
      // (lets a follow-up edit target them instead of re-inserting).
      if (Array.isArray(data.items)) {
        setItems(
          data.items.map((it: { id: string; category: string; title: string; description: string }) => ({
            key: newKey(),
            id: it.id,
            category: it.category,
            title: it.title,
            description: it.description,
          }))
        )
      }
      setSavedAt(Date.now())
      if (live && data.submissionsReset) {
        setNotice('Items changed — everyone was sent back to re-rank the corrected list.')
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function activate() {
    if (clean.length < 2) {
      setError('Add at least two items before activating.')
      return
    }
    setActivating(true)
    const ok = await save()
    if (!ok) {
      setActivating(false)
      return
    }
    try {
      const res = await fetch(`/api/workshop/sessions/${workshopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Could not activate')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not activate')
      setActivating(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <Link
          href={live ? `/workshop/${workshopId}` : '/workshop'}
          className="text-sm text-ink-muted hover:text-ink"
        >
          {live ? '← Back to workshop' : '← All workshops'}
        </Link>
        <header className="mt-3 mb-6">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-canvas border border-line text-[11px] font-bold uppercase tracking-widest text-ink-muted mb-2">
            {live ? 'Editing items · round 1 live' : 'Draft · setup'}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-light text-ink tracking-tight">{name}</h1>
          {description && <p className="text-ink-soft mt-1">{description}</p>}
        </header>

        {live && (
          <div className="mb-6 p-3 rounded-lg border border-accent/40 bg-accent/10 text-sm text-ink-soft">
            <strong className="text-ink">Editing a live workshop.</strong> Fixing a title or description won&apos;t
            disturb anyone. Adding, removing, or re-categorizing an item sends everyone back to re-rank the
            corrected list for this round.
          </div>
        )}

        {/* CSV upload — initial setup only; live edits are surgical */}
        {!live && (
        <section className="mb-6 p-4 bg-surface border border-line rounded-lg">
          <label className="block text-sm font-semibold text-ink mb-1">Upload items (CSV)</label>
          <p className="text-xs text-ink-muted mb-3">
            Columns: <code className="text-ink-soft">category, title, description</code>. A header row is
            optional. Everything imports into the editable list below, so you can fix anything before activating.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v12" />
              </svg>
              Choose CSV file
              <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
            </label>
            <a href={TEMPLATE_HREF} download="workshop-items-template.csv" className="text-sm text-ink-soft hover:text-ink underline">
              Download template
            </a>
          </div>
        </section>
        )}

        {/* Editable list */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted">
              {clean.length} item{clean.length === 1 ? '' : 's'} · {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
            </h2>
            <div className="flex items-center gap-2">
              {!live && items.length > 0 && (
                <button
                  onClick={clearAll}
                  className="px-3 py-1.5 bg-canvas border border-line text-ink-muted text-sm font-medium rounded-md hover:border-fail-line hover:text-fail transition-colors"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={addRow}
                className="px-3 py-1.5 bg-canvas border border-line text-ink text-sm font-medium rounded-md hover:border-ink transition-colors"
              >
                + Add row
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-center py-10 text-ink-muted text-sm bg-surface border border-line rounded-lg">
              No items yet. Upload a CSV above or add rows manually.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.key} className="flex items-start gap-2 p-2 bg-surface border border-line rounded-lg">
                  <input
                    value={it.category}
                    onChange={(e) => update(it.key, 'category', e.target.value)}
                    placeholder="Category"
                    className="w-32 shrink-0 px-2 py-1.5 border border-line rounded-md text-sm text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input
                      value={it.title}
                      onChange={(e) => update(it.key, 'title', e.target.value)}
                      placeholder="Title"
                      className="w-full px-2 py-1.5 border border-line rounded-md text-sm font-medium text-ink bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
                    />
                    <input
                      value={it.description}
                      onChange={(e) => update(it.key, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-2 py-1.5 border border-line rounded-md text-xs text-ink-soft bg-canvas focus:outline-none focus:ring-1 focus:ring-ink"
                    />
                  </div>
                  <button
                    onClick={() => remove(it.key)}
                    aria-label="Remove item"
                    className="shrink-0 mt-1 text-ink-muted hover:text-fail transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && (
          <div className="mb-4 p-3 bg-fail-soft border border-fail-line rounded-md text-fail text-sm">{error}</div>
        )}
        {notice && (
          <div className="mb-4 p-3 bg-info/20 border border-info rounded-md text-ink text-sm">{notice}</div>
        )}

        <div className="flex items-center gap-3 flex-wrap sticky bottom-0 py-3 bg-canvas/90 backdrop-blur border-t border-line">
          {live ? (
            <>
              <button
                onClick={save}
                disabled={saving || clean.length < 2}
                className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <Link
                href={`/workshop/${workshopId}`}
                className="px-4 py-2 bg-canvas border border-line text-ink-soft text-sm font-medium rounded-md hover:border-ink transition-colors"
              >
                Done
              </Link>
              {savedAt && !saving && <span className="text-xs text-pass">✓ Saved</span>}
            </>
          ) : (
            <>
              <button
                onClick={save}
                disabled={saving || activating}
                className="px-4 py-2 bg-canvas border border-ink text-ink text-sm font-semibold rounded-md hover:bg-surface disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button
                onClick={activate}
                disabled={activating || saving || clean.length < 2}
                className="px-4 py-2 bg-ink text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {activating ? 'Activating…' : 'Activate workshop →'}
              </button>
              {savedAt && !saving && <span className="text-xs text-pass">✓ Saved</span>}
              <span className="text-xs text-ink-muted">Activating locks the item list and opens ranking for everyone.</span>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
