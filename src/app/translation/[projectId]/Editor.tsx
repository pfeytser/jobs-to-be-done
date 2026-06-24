'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { missingTokens } from '@/lib/translation/placeholders'
import type { TranslationProject, Entry, DatasetMeta } from '@/lib/translation/types'

const PAGE_SIZE = 50

// Which side the search box matches against (across all sources).
type ScopeSide = 'target' | 'english'

// The reviewer's workflow is find-and-fix: they spot a translation on the live
// site they dislike, come here, and paste it to locate the row. So search is the
// entry point — we load NOTHING on landing and lazily fetch the full entry set
// for the active language the first time they search, then match client-side.

// Recompute an entry's status flags after an inline edit (mirrors the server).
function recompute(entry: Entry, value: string): Entry {
  const missing = missingTokens(entry.english, value)
  return {
    ...entry,
    value,
    edited: value !== entry.original,
    empty: value.trim() === '' && entry.english.trim() !== '',
    identical: value.trim() !== '' && value === entry.english,
    placeholderWarning: missing.length > 0,
    missingTokens: missing,
  }
}

export function Editor({
  project,
  isOwner,
  initialLanguages,
}: {
  project: TranslationProject
  isOwner: boolean
  initialDatasets: DatasetMeta[]
  initialLanguages: string[]
}) {
  // Sources are managed in /translation/admin; the editor only reads them.
  const languages = initialLanguages
  const [activeLang, setActiveLang] = useState(initialLanguages[0] ?? '')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loadedLang, setLoadedLang] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // Which side to match — the translation (default) or English. Spans all sources.
  const [scope, setScope] = useState<ScopeSide>('target')
  const [page, setPage] = useState(0)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  // Debounce search so a paste doesn't fire a fetch / refilter on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => setPage(0), [debouncedSearch, scope, activeLang])

  const loadEntries = useCallback(
    async (lang: string) => {
      if (!lang) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/translation/projects/${project.id}/entries?lang=${encodeURIComponent(lang)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not load entries')
        setEntries(data.entries)
        setLoadedLang(lang)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    },
    [project.id],
  )

  // Switching language invalidates the cached entries.
  useEffect(() => {
    setEntries([])
    setLoadedLang(null)
  }, [activeLang])

  // Lazily fetch the full entry set the first time there's a search for this language.
  useEffect(() => {
    if (!debouncedSearch.trim()) return
    if (loadedLang === activeLang || loading) return
    loadEntries(activeLang)
  }, [debouncedSearch, activeLang, loadedLang, loading, loadEntries])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  // --- filtering ----------------------------------------------------------
  const hasQuery = debouncedSearch.trim() !== ''
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return []
    return entries.filter((e) => {
      const hay = (scope === 'english' ? e.english : e.value).toLowerCase()
      return hay.includes(q)
    })
  }, [entries, debouncedSearch, scope])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  // --- editing ------------------------------------------------------------
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const markSaving = (id: string, on: boolean) =>
    setSavingIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  function onEdit(entry: Entry, value: string) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? recompute(e, value) : e)))
    const timers = saveTimers.current
    const existing = timers.get(entry.id)
    if (existing) clearTimeout(existing)
    timers.set(
      entry.id,
      setTimeout(async () => {
        markSaving(entry.id, true)
        try {
          if (value === entry.original) {
            // Reverted to original — drop the stored edit.
            await fetch(`/api/translation/projects/${project.id}/edits`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ datasetId: entry.datasetId, lang: activeLang, entryKey: entry.entryKey }),
            })
          } else {
            await fetch(`/api/translation/projects/${project.id}/edits`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ datasetId: entry.datasetId, lang: activeLang, entryKey: entry.entryKey, value }),
            })
          }
        } catch {
          setError('Could not save an edit — check your connection.')
        } finally {
          markSaving(entry.id, false)
        }
      }, 500),
    )
  }

  function revert(entry: Entry) {
    onEdit(entry, entry.original)
  }

  // --- export -------------------------------------------------------------
  async function runExport(scope: 'lang' | 'all', format?: 'patch') {
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (scope === 'lang') qs.set('lang', activeLang)
      if (format === 'patch') qs.set('format', 'patch')
      const res = await fetch(`/api/translation/projects/${project.id}/export?${qs.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Export failed')
      }
      const summaryHeader = res.headers.get('X-Translation-Summary')
      const blob = await res.blob()
      const dispo = res.headers.get('Content-Disposition') ?? ''
      const match = dispo.match(/filename="([^"]+)"/)
      const fileName = match ? match[1] : 'export'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      if (summaryHeader) {
        try {
          const summary = JSON.parse(decodeURIComponent(summaryHeader)) as {
            files: { name: string; edited: number; blank: number; warnings: number }[]
          }
          const t = summary.files.reduce(
            (acc, f) => ({ edited: acc.edited + f.edited, blank: acc.blank + f.blank, warnings: acc.warnings + f.warnings }),
            { edited: 0, blank: 0, warnings: 0 },
          )
          setToast(`Exported ${summary.files.length} file(s): ${t.edited} edited, ${t.blank} blank, ${t.warnings} placeholder warnings.`)
        } catch {
          setToast('Export complete.')
        }
      } else {
        setToast('Export complete.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/translation" className="text-sm text-ink-3 hover:text-ink transition-colors">
            ← Projects
          </Link>
          <h1 className="text-lg font-bold text-ink">{project.name}</h1>
        </div>
        {isOwner && (
          <Link
            href={`/translation/admin/${project.id}`}
            className="px-3 py-1.5 text-sm text-ink-2 hover:text-ink border border-warm-border rounded-[10px] bg-surface"
          >
            ⚙ Setup
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-status-fail-text mb-3">{error}</p>}

      {languages.length === 0 ? (
        <div className="bg-surface border border-warm-border rounded-[16px] p-10 text-center text-ink-3">
          {isOwner ? (
            <>
              No sources loaded yet.{' '}
              <Link href={`/translation/admin/${project.id}`} className="text-ink underline">
                Go to Setup
              </Link>{' '}
              to load an English UI JSON with target files, or a CSV.
            </>
          ) : (
            'No sources have been loaded for this project yet.'
          )}
        </div>
      ) : (
        <>
          {/* Language tabs + export */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex gap-2 flex-wrap">
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`px-3.5 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                    activeLang === lang
                      ? 'bg-ink text-white border-ink'
                      : 'bg-surface text-ink-2 border-warm-border hover:border-ink'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => runExport('lang')}
                className="px-3 py-1.5 text-sm font-medium border border-warm-border rounded-[10px] bg-surface hover:border-ink"
              >
                ⤓ Export {activeLang}
              </button>
              <button
                onClick={() => runExport('all')}
                className="px-3 py-1.5 text-sm font-medium bg-ink text-white rounded-[10px] hover:opacity-90"
              >
                ⤓ Export all
              </button>
              <button
                onClick={() => runExport('lang', 'patch')}
                title="A nested JSON of only the keys you changed — deep-merges into the repo locale file. Ideal to hand to a coding agent."
                className="px-3 py-1.5 text-sm font-medium border border-warm-border rounded-[10px] bg-surface hover:border-ink"
              >
                ⤓ Changes for Devin
              </button>
            </div>
          </div>

          {/* Search + scope */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Paste a phrase you saw on the site to find it — searching ${
                scope === 'english' ? 'English' : 'the translation'
              }.`}
              className="flex-1 min-w-[280px] px-3.5 py-2 text-sm border border-warm-border rounded-[10px] bg-surface focus:outline-none focus:border-ink"
            />
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeSide)}
              title="Choose which side to search"
              className="px-3 py-2 text-sm border border-warm-border rounded-[10px] bg-surface focus:outline-none focus:border-ink"
            >
              <option value="target">Search {activeLang} (translation)</option>
              <option value="english">Search English</option>
            </select>
          </div>

          {/* Result count */}
          {hasQuery && !loading && (
            <p className="text-xs text-ink-3 mb-3">
              {filtered.length.toLocaleString()} match{filtered.length === 1 ? '' : 'es'}
            </p>
          )}

          {/* Table */}
          {loading ? (
            <div className="bg-surface border border-warm-border rounded-[16px] p-10 text-center text-ink-3">Loading…</div>
          ) : !hasQuery ? (
            <div className="bg-surface border border-warm-border rounded-[16px] p-12 text-center text-ink-3">
              <p className="text-sm">
                Search to begin — paste a phrase you saw on the site to find the row and fix it.
              </p>
              <p className="text-xs mt-1.5">
                Searching the {activeLang} translation by default. Switch the dropdown to search English instead.
              </p>
            </div>
          ) : (
            <div className="border border-warm-border rounded-[16px] overflow-hidden bg-surface">
              <div className="grid grid-cols-[minmax(220px,1fr)_minmax(220px,1.3fr)_minmax(220px,1.3fr)] bg-canvas border-b border-warm-border text-[11px] uppercase tracking-wide text-ink-3 font-medium">
                <div className="px-4 py-2.5">Key / Source</div>
                <div className="px-4 py-2.5 border-l border-warm-border">English</div>
                <div className="px-4 py-2.5 border-l border-warm-border">Translation — {activeLang}</div>
              </div>
              {pageItems.length === 0 ? (
                <div className="p-10 text-center text-ink-3 text-sm">No matching strings.</div>
              ) : (
                pageItems.map((e) => (
                  <Row
                    key={e.id}
                    entry={e}
                    saving={savingIds.has(e.id)}
                    onEdit={(v) => onEdit(e, v)}
                    onRevert={() => revert(e)}
                  />
                ))
              )}
            </div>
          )}

          {/* Pager */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 mt-4 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 border border-warm-border rounded-[10px] bg-surface disabled:opacity-40 hover:border-ink"
              >
                ‹ Prev
              </button>
              <span className="text-ink-3">
                Page {page + 1} of {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="px-3 py-1.5 border border-warm-border rounded-[10px] bg-surface disabled:opacity-40 hover:border-ink"
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white text-sm px-4 py-2.5 rounded-[12px] shadow-lg max-w-[90vw]">
          {toast}
        </div>
      )}
    </div>
  )
}

function Row({
  entry,
  saving,
  onEdit,
  onRevert,
}: {
  entry: Entry
  saving: boolean
  onEdit: (value: string) => void
  onRevert: () => void
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea to fit content.
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [entry.value])

  return (
    <div className="grid grid-cols-[minmax(220px,1fr)_minmax(220px,1.3fr)_minmax(220px,1.3fr)] border-b border-warm-border last:border-b-0">
      <div className="px-4 py-3 min-w-0">
        <p className="text-xs text-ink-2 break-words font-mono leading-snug">{entry.label}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge tone="neutral">{entry.source}</Badge>
          {entry.empty && <Badge tone="warn">empty</Badge>}
          {entry.edited && <Badge tone="accent">edited</Badge>}
          {entry.identical && <Badge tone="neutral">= English</Badge>}
          {entry.placeholderWarning && <Badge tone="warn">⚠ placeholder</Badge>}
          {entry.edited && (
            <button onClick={onRevert} className="text-[10px] text-ink-3 underline hover:text-ink">
              revert
            </button>
          )}
        </div>
      </div>
      <div className="px-4 py-3 border-l border-warm-border text-sm text-ink select-text whitespace-pre-wrap break-words">
        {entry.english}
      </div>
      <div className="px-4 py-3 border-l border-warm-border">
        <textarea
          ref={taRef}
          value={entry.value}
          onChange={(e) => onEdit(e.target.value)}
          rows={1}
          className={`w-full resize-none text-sm bg-canvas rounded-[8px] px-2.5 py-2 border focus:outline-none focus:border-ink overflow-hidden ${
            entry.edited ? 'border-ink' : 'border-warm-border'
          } ${entry.empty ? 'bg-[#FCF6EC]' : ''} ${entry.placeholderWarning ? 'bg-[#FEF3C7]' : ''}`}
        />
        {entry.placeholderWarning && (
          <p className="text-[10px] text-status-blocked-text mt-1">Missing: {entry.missingTokens.join(' ')}</p>
        )}
        <p className="text-[10px] text-ink-3 mt-1 h-3">{saving ? 'saving…' : entry.edited ? 'saved' : ''}</p>
      </div>
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'neutral' | 'accent' | 'warn' }) {
  const cls =
    tone === 'accent'
      ? 'bg-mist text-ink border-warm-border'
      : tone === 'warn'
        ? 'bg-status-blocked text-status-blocked-text border-status-blocked-border'
        : 'bg-canvas text-ink-3 border-warm-border'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>
}
