'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { missingTokens } from '@/lib/translation/placeholders'
import {
  tokenizeMarkup,
  tagTokens,
  tagLabel,
  availableFormats,
  validateMarkup,
  type TagToken,
  type FormatOption,
} from '@/lib/translation/markup'
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
    tagError: validateMarkup(entry.english, value).error,
  }
}

// Friendly chip text: open → "italic", close → "/italic", void → "line break".
function chipText(token: TagToken): string {
  const label = tagLabel(token.name)
  return token.kind === 'close' ? `/${label}` : label
}

const CHIP_CLASS =
  'inline-flex items-center gap-0.5 align-middle mx-[1px] px-1 rounded border text-[11px] font-medium text-ink-soft bg-info border-line select-none cursor-default'
const CHIP_X_CLASS = 'ml-0.5 text-ink-muted hover:text-fail cursor-pointer leading-none'
const CHIP_RO_CLASS =
  'inline-flex items-center align-middle mx-[1px] px-1 rounded border text-[11px] font-medium text-ink-muted bg-canvas border-line select-none'

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

  // The visible result set is snapshotted when the SEARCH changes, not on every edit.
  // Otherwise editing a translation (the default search scope) would shrink the match
  // and make the row you're editing vanish mid-keystroke.
  const [matchedIds, setMatchedIds] = useState<string[]>([])
  useEffect(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) {
      setMatchedIds([])
      return
    }
    setMatchedIds(
      entries
        .filter((e) => (scope === 'english' ? e.english : e.value).toLowerCase().includes(q))
        .map((e) => e.id),
    )
    // Intentionally excludes `entries`: recompute only when the query/scope/loaded set
    // changes, never on an in-place value edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, scope, loadedLang])

  const filtered = useMemo(() => {
    if (matchedIds.length === 0) return []
    const byId = new Map(entries.map((e) => [e.id, e]))
    return matchedIds.map((id) => byId.get(id)).filter((e): e is Entry => e !== undefined)
  }, [entries, matchedIds])

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
    const updated = recompute(entry, value)
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))
    const timers = saveTimers.current
    const existing = timers.get(entry.id)
    if (existing) clearTimeout(existing)
    // Never autosave broken markup — the row shows the error until it's fixed.
    if (updated.tagError) {
      markSaving(entry.id, false)
      return
    }
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
            const res = await fetch(`/api/translation/projects/${project.id}/edits`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ datasetId: entry.datasetId, lang: activeLang, entryKey: entry.entryKey, value }),
            })
            if (!res.ok) {
              const data = await res.json().catch(() => ({}))
              setError(data.error ?? 'Could not save an edit.')
            }
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
    <div className="max-w-wide mx-auto px-6 py-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/translation" className="text-sm text-ink-muted hover:text-ink transition-colors">
            ← Projects
          </Link>
          <h1 className="text-lg font-bold text-ink">{project.name}</h1>
        </div>
        {isOwner && (
          <Link
            href={`/translation/admin/${project.id}`}
            className="px-3 py-1.5 text-sm text-ink-soft hover:text-ink border border-line rounded-sm bg-surface"
          >
            ⚙ Setup
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-fail mb-3">{error}</p>}

      {languages.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-10 text-center text-ink-muted">
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
                      : 'bg-surface text-ink-soft border-line hover:border-ink'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => runExport('lang')}
                className="px-3 py-1.5 text-sm font-medium border border-line rounded-sm bg-surface hover:border-ink"
              >
                ⤓ Export {activeLang}
              </button>
              <button
                onClick={() => runExport('all')}
                className="px-3 py-1.5 text-sm font-medium bg-ink text-white rounded-sm hover:opacity-90"
              >
                ⤓ Export all
              </button>
              <button
                onClick={() => runExport('lang', 'patch')}
                title="A nested JSON of only the keys you changed — deep-merges into the repo locale file. Ideal to hand to a coding agent."
                className="px-3 py-1.5 text-sm font-medium border border-line rounded-sm bg-surface hover:border-ink"
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
              className="flex-1 min-w-[280px] px-3.5 py-2 text-sm border border-line rounded-sm bg-surface focus:outline-none focus:border-ink"
            />
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeSide)}
              title="Choose which side to search"
              className="px-3 py-2 text-sm border border-line rounded-sm bg-surface focus:outline-none focus:border-ink"
            >
              <option value="target">Search {activeLang} (translation)</option>
              <option value="english">Search English</option>
            </select>
          </div>

          {/* Result count */}
          {hasQuery && !loading && (
            <p className="text-xs text-ink-muted mb-3">
              {filtered.length.toLocaleString()} match{filtered.length === 1 ? '' : 'es'}
            </p>
          )}

          {/* Table */}
          {loading ? (
            <div className="bg-surface border border-line rounded-lg p-10 text-center text-ink-muted">Loading…</div>
          ) : !hasQuery ? (
            <div className="bg-surface border border-line rounded-lg p-12 text-center text-ink-muted">
              <p className="text-sm">
                Search to begin — paste a phrase you saw on the site to find the row and fix it.
              </p>
              <p className="text-xs mt-1.5">
                Searching the {activeLang} translation by default. Switch the dropdown to search English instead.
              </p>
            </div>
          ) : (
            <div className="border border-line rounded-lg overflow-hidden bg-surface">
              <div className="grid grid-cols-[minmax(220px,1fr)_minmax(220px,1.3fr)_minmax(220px,1.3fr)] bg-canvas border-b border-line text-[11px] uppercase tracking-wide text-ink-muted font-medium">
                <div className="px-4 py-2.5">Key / Source</div>
                <div className="px-4 py-2.5 border-l border-line">English</div>
                <div className="px-4 py-2.5 border-l border-line">Translation — {activeLang}</div>
              </div>
              {pageItems.length === 0 ? (
                <div className="p-10 text-center text-ink-muted text-sm">No matching strings.</div>
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
                className="px-3 py-1.5 border border-line rounded-sm bg-surface disabled:opacity-40 hover:border-ink"
              >
                ‹ Prev
              </button>
              <span className="text-ink-muted">
                Page {page + 1} of {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="px-3 py-1.5 border border-line rounded-sm bg-surface disabled:opacity-40 hover:border-ink"
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white text-sm px-4 py-2.5 rounded-md shadow-lg max-w-[90vw]">
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
  const formats = useMemo(() => availableFormats(entry.english), [entry.english])

  return (
    <div className="grid grid-cols-[minmax(220px,1fr)_minmax(220px,1.3fr)_minmax(220px,1.3fr)] border-b border-line last:border-b-0">
      <div className="px-4 py-3 min-w-0">
        <p className="text-xs text-ink-soft break-words font-mono leading-snug">{entry.label}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge tone="neutral">{entry.source}</Badge>
          {entry.empty && <Badge tone="warn">empty</Badge>}
          {entry.edited && <Badge tone="accent">edited</Badge>}
          {entry.identical && <Badge tone="neutral">= English</Badge>}
          {entry.tagError && <Badge tone="warn">⚠ tags</Badge>}
          {entry.placeholderWarning && <Badge tone="warn">⚠ placeholder</Badge>}
          {entry.edited && (
            <button onClick={onRevert} className="text-[10px] text-ink-muted underline hover:text-ink">
              revert
            </button>
          )}
        </div>
      </div>
      <div className="px-4 py-3 border-l border-line text-sm text-ink select-text leading-relaxed">
        <ReadOnlyMarkup text={entry.english} />
      </div>
      <div className="px-4 py-3 border-l border-line">
        <ChipEditor
          value={entry.value}
          invalid={!!entry.tagError}
          empty={entry.empty}
          formats={formats}
          onChange={onEdit}
        />
        {entry.tagError ? (
          <p className="text-[10px] text-fail mt-1">{entry.tagError}</p>
        ) : entry.placeholderWarning ? (
          <p className="text-[10px] text-blocked mt-1">Missing: {entry.missingTokens.join(' ')}</p>
        ) : null}
        <p className="text-[10px] text-ink-muted mt-1 h-3">
          {entry.tagError ? (
            <span className="text-fail">Fix the formatting tags to save.</span>
          ) : saving ? (
            'saving…'
          ) : entry.edited ? (
            'saved'
          ) : (
            ''
          )}
        </p>
      </div>
    </div>
  )
}

// Read-only render of an English value: words plus protected tag chips, so reviewers
// can see exactly which tags their translation must keep.
function ReadOnlyMarkup({ text }: { text: string }) {
  const segs = useMemo(() => tokenizeMarkup(text), [text])
  return (
    <span className="whitespace-pre-wrap break-words">
      {segs.map((seg, i) =>
        seg.type === 'text' ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span key={i} title={seg.token.raw} className={CHIP_RO_CLASS}>
            {chipText(seg.token)}
          </span>
        ),
      )}
    </span>
  )
}

// Chip editor: tags render as protected, non-editable chips; reviewers type only the
// words between them. The editable DOM is managed imperatively (uncontrolled) so React
// re-renders don't reset the caret — we render from `value` only when it changes
// externally (e.g. a revert), and serialize back to a string on every input.
function ChipEditor({
  value,
  invalid,
  empty,
  formats,
  onChange,
}: {
  value: string
  invalid: boolean
  empty: boolean
  formats: FormatOption[]
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<string | null>(null)

  const buildChip = useCallback((token: TagToken): HTMLSpanElement => {
    const span = document.createElement('span')
    span.dataset.token = token.raw
    span.dataset.name = token.name
    span.dataset.kind = token.kind
    span.contentEditable = 'false'
    span.className = CHIP_CLASS
    span.title = token.raw
    const label = document.createElement('span')
    label.textContent = chipText(token)
    span.appendChild(label)
    const x = document.createElement('span')
    x.className = CHIP_X_CLASS
    x.dataset.del = '1'
    x.textContent = '×'
    x.title = 'Remove this tag'
    span.appendChild(x)
    return span
  }, [])

  const renderInto = useCallback(
    (el: HTMLDivElement, text: string) => {
      el.textContent = ''
      for (const seg of tokenizeMarkup(text)) {
        if (seg.type === 'text') el.appendChild(document.createTextNode(seg.value))
        else el.appendChild(buildChip(seg.token))
      }
    },
    [buildChip],
  )

  const serialize = useCallback((el: HTMLDivElement): string => {
    let out = ''
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? ''
      else if (n instanceof HTMLElement) {
        if (n.dataset.token !== undefined) out += n.dataset.token
        else if (n.tagName === 'BR') out += '\n'
        else out += n.textContent ?? ''
      }
    })
    return out
  }, [])

  const emit = useCallback(() => {
    const el = ref.current
    if (!el) return
    const v = serialize(el)
    lastEmitted.current = v
    onChange(v)
  }, [serialize, onChange])

  // (Re)render the DOM only when `value` arrives different from what we last emitted.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (lastEmitted.current === value) return
    renderInto(el, value)
    lastEmitted.current = value
  }, [value, renderInto])

  // Block accidental chip deletion with a collapsed caret; turn Enter into a newline.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      document.execCommand('insertText', false, '\n')
      emit()
      return
    }
    if (e.key !== 'Backspace' && e.key !== 'Delete') return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const r = sel.getRangeAt(0)
    if (!r.collapsed) return
    const node = adjacentNode(r, e.key === 'Backspace' ? 'before' : 'after')
    if (node instanceof HTMLElement && node.dataset.token !== undefined) e.preventDefault()
  }

  // Paste as plain text only — never let pasted HTML inject untracked tags/markup.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    emit()
  }

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const t = e.target
    if (t instanceof HTMLElement && t.dataset.del === '1') {
      e.preventDefault()
      const chip = t.closest('[data-token]')
      const el = ref.current
      if (chip instanceof HTMLElement && el) {
        removeChipPair(el, chip)
        emit()
      }
    }
  }

  function applyFormat(fmt: FormatOption) {
    const el = ref.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const r = sel.getRangeAt(0)
    // Only wrap a non-empty selection inside a single text node (never across chips).
    if (r.collapsed || r.startContainer !== r.endContainer || r.startContainer.nodeType !== Node.TEXT_NODE) return
    if (!el.contains(r.startContainer)) return
    const text = r.toString()
    if (!text) return
    r.deleteContents()
    const frag = document.createDocumentFragment()
    frag.appendChild(buildChip(tagTokens(fmt.openRaw)[0]))
    frag.appendChild(document.createTextNode(text))
    frag.appendChild(buildChip(tagTokens(fmt.closeRaw)[0]))
    r.insertNode(frag)
    sel.removeAllRanges()
    emit()
  }

  return (
    <div>
      {formats.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {formats.map((f) => (
            <button
              key={f.name}
              type="button"
              // preventDefault on mousedown keeps the editor's text selection alive
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat(f)}
              title={`Wrap the selected words in ${f.label.toLowerCase()}`}
              className="px-1.5 py-0.5 text-[11px] font-medium border border-line rounded bg-surface hover:border-ink text-ink-soft"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={emit}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onClick={onClick}
        className={`min-h-[38px] w-full text-sm rounded-xs px-2.5 py-2 border focus:outline-none focus:border-ink whitespace-pre-wrap break-words leading-relaxed ${
          invalid ? 'border-fail bg-fail-soft' : empty ? 'border-line bg-sunken' : 'border-line bg-canvas'
        }`}
      />
    </div>
  )
}

// The chip node immediately before/after a collapsed caret, if any.
function adjacentNode(r: Range, dir: 'before' | 'after'): Node | null {
  const c = r.startContainer
  if (c.nodeType === Node.TEXT_NODE) {
    if (dir === 'before') return r.startOffset === 0 ? c.previousSibling : null
    return r.startOffset === (c.textContent?.length ?? 0) ? c.nextSibling : null
  }
  const kids = c.childNodes
  return dir === 'before' ? kids[r.startOffset - 1] ?? null : kids[r.startOffset] ?? null
}

// Remove a chip and (for a paired tag) its matching partner, so pairs stay balanced.
function removeChipPair(el: HTMLElement, chip: HTMLElement) {
  const kind = chip.dataset.kind
  const name = chip.dataset.name
  if (kind === 'void' || !name) {
    chip.remove()
    return
  }
  const chips = [...el.querySelectorAll<HTMLElement>('[data-token]')]
  const idx = chips.indexOf(chip)
  if (kind === 'open') {
    let depth = 0
    for (let i = idx + 1; i < chips.length; i++) {
      const c = chips[i]
      if (c.dataset.name !== name) continue
      if (c.dataset.kind === 'open') depth++
      else if (c.dataset.kind === 'close') {
        if (depth === 0) {
          c.remove()
          break
        }
        depth--
      }
    }
  } else {
    let depth = 0
    for (let i = idx - 1; i >= 0; i--) {
      const c = chips[i]
      if (c.dataset.name !== name) continue
      if (c.dataset.kind === 'close') depth++
      else if (c.dataset.kind === 'open') {
        if (depth === 0) {
          c.remove()
          break
        }
        depth--
      }
    }
  }
  chip.remove()
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'neutral' | 'accent' | 'warn' }) {
  const cls =
    tone === 'accent'
      ? 'bg-info text-ink border-line'
      : tone === 'warn'
        ? 'bg-blocked-soft text-blocked border-blocked-line'
        : 'bg-canvas text-ink-muted border-line'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>
}
