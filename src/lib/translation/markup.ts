// Inline-markup model for the chip editor + tag-integrity validation.
//
// Translation values contain HTML-ish tags that must survive translation exactly:
// app-rendered placeholders (<link>…</link>, <important>…), links with attributes
// (<a href='/locations'>…</a>), and real formatting (<b>, <i>, <strong>). Reviewers
// are non-technical, so the editor renders every tag as a protected "chip" and only
// lets them edit the words in between. This module is the pure (DOM-free) core:
// tokenizing a string into text/tag segments, friendly labels, and validation.

const TAG_RE = /<\/?[a-zA-Z][^>]*?>/g

export type TagKind = 'open' | 'close' | 'void'

export interface TagToken {
  raw: string // exact source substring, e.g. "<a href='/x'>", "</link>", "<br/>"
  kind: TagKind
  name: string // lowercased tag name, e.g. "a", "link", "br"
}

export type Segment = { type: 'text'; value: string } | { type: 'tag'; token: TagToken }

const VOID_NAMES = new Set(['br', 'hr', 'img', 'input', 'wbr', 'meta', 'source'])

function classifyTag(raw: string): TagToken {
  const name = (raw.match(/^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/)?.[1] ?? '').toLowerCase()
  const isClose = /^<\s*\//.test(raw)
  const isSelfClosing = /\/\s*>$/.test(raw)
  const kind: TagKind = isClose ? 'close' : isSelfClosing || VOID_NAMES.has(name) ? 'void' : 'open'
  return { raw, kind, name }
}

// Split a string into ordered text and tag segments, preserving everything verbatim.
export function tokenizeMarkup(text: string): Segment[] {
  const segs: Segment[] = []
  let last = 0
  for (const m of text.matchAll(TAG_RE)) {
    const i = m.index ?? 0
    if (i > last) segs.push({ type: 'text', value: text.slice(last, i) })
    segs.push({ type: 'tag', token: classifyTag(m[0]) })
    last = i + m[0].length
  }
  if (last < text.length) segs.push({ type: 'text', value: text.slice(last) })
  return segs
}

export function tagTokens(text: string): TagToken[] {
  return [...text.matchAll(TAG_RE)].map((m) => classifyTag(m[0]))
}

export function hasTags(text: string): boolean {
  TAG_RE.lastIndex = 0
  return TAG_RE.test(text)
}

// --- friendly labels -------------------------------------------------------

const LABELS: Record<string, string> = {
  i: 'italic',
  em: 'italic',
  italic: 'italic',
  b: 'bold',
  strong: 'bold',
  bold: 'bold',
  u: 'underline',
  br: 'line break',
  a: 'link',
  link: 'link',
  ul: 'list',
  ol: 'list',
  li: 'list item',
  p: 'paragraph',
  span: 'styled text',
}

// A short, non-technical label for a tag (falls back to the tag name itself).
export function tagLabel(name: string): string {
  return LABELS[name] ?? name
}

// --- "add formatting" toolbar ---------------------------------------------

// Attribute-less names we'll let a reviewer apply via a toolbar button.
const FORMATTABLE = new Set(['i', 'em', 'italic', 'b', 'strong', 'bold', 'u'])

export interface FormatOption {
  name: string
  label: string // "Italic", "Bold", …
  openRaw: string // exact tag to insert, e.g. "<italic>"
  closeRaw: string // e.g. "</italic>"
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Formatting options offered for a row = the attribute-less paired formatting tags
// that appear in *that row's English*. Keeps reviewers adding only context-appropriate
// formatting, and matches the validation rule (same tag set as English).
export function availableFormats(english: string): FormatOption[] {
  const tokens = tagTokens(english)
  const closeNames = new Set(tokens.filter((t) => t.kind === 'close').map((t) => t.name))
  const byName = new Map<string, FormatOption>()
  for (const t of tokens) {
    if (t.kind !== 'open') continue
    if (!FORMATTABLE.has(t.name)) continue
    // attribute-less only: the raw between < and > is exactly the name
    const inner = t.raw.slice(1, -1).trim()
    if (inner.toLowerCase() !== t.name) continue
    if (!closeNames.has(t.name)) continue
    if (byName.has(t.name)) continue
    byName.set(t.name, {
      name: t.name,
      label: titleCase(tagLabel(t.name)),
      openRaw: t.raw,
      closeRaw: `</${t.name}>`,
    })
  }
  return [...byName.values()]
}

// --- validation ------------------------------------------------------------

function multiset(tokens: TagToken[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of tokens) m.set(t.raw, (m.get(t.raw) ?? 0) + 1)
  return m
}

// Well-nested ignoring void tags. Used only to compare translation vs English so we
// never demand cleaner markup than the source already has.
function isWellNested(tokens: TagToken[]): boolean {
  const stack: string[] = []
  for (const t of tokens) {
    if (t.kind === 'open') stack.push(t.name)
    else if (t.kind === 'close') {
      if (stack.pop() !== t.name) return false
    }
  }
  return stack.length === 0
}

export interface MarkupResult {
  ok: boolean
  error: string | null
}

// Validate a translation's tags against its English. Blocking rule (see file header):
//   1. Same multiset of exact tag tokens as the English.
//   2. Well-nested — but only enforced when the English itself is well-nested.
// An empty (untranslated) value is always allowed.
export function validateMarkup(english: string, translation: string): MarkupResult {
  if (!translation.trim()) return { ok: true, error: null }

  const en = tagTokens(english)
  if (en.length === 0 && !hasTags(translation)) return { ok: true, error: null }

  const tg = tagTokens(translation)
  const enSet = multiset(en)
  const tgSet = multiset(tg)

  const missing: string[] = []
  const extra: string[] = []
  for (const [raw, n] of enSet) {
    const d = n - (tgSet.get(raw) ?? 0)
    if (d > 0) missing.push(...Array(d).fill(raw))
  }
  for (const [raw, n] of tgSet) {
    const d = n - (enSet.get(raw) ?? 0)
    if (d > 0) extra.push(...Array(d).fill(raw))
  }

  if (missing.length || extra.length) {
    const parts: string[] = []
    if (missing.length) parts.push(`missing ${summarize(missing)}`)
    if (extra.length) parts.push(`has an extra ${summarize(extra)}`)
    return {
      ok: false,
      error: `Formatting doesn't match the English — it ${parts.join(' and ')}. Use the revert link to restore the original tags, then re-edit the text.`,
    }
  }

  if (isWellNested(en) && !isWellNested(tg)) {
    return {
      ok: false,
      error: 'A formatting tag is left open or closed in the wrong order. Revert and try again.',
    }
  }

  return { ok: true, error: null }
}

// "the italic tag", "2 tags (link, bold)" — a friendly summary of a token list.
function summarize(raws: string[]): string {
  const names = raws.map((r) => tagLabel(classifyTag(r).name))
  const uniq = [...new Set(names)]
  if (raws.length === 1) return `the ${names[0]} tag`
  return `${raws.length} tags (${uniq.join(', ')})`
}
