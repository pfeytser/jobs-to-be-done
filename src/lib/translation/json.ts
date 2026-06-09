// UI JSON dictionary handling (brief §8.1).
//
// Strings are addressed by a key path. We support nested objects and arrays. The
// canonical shape always comes from the English source; target files are only ever
// read for their leaf string values, never trusted for structure.

export interface JsonLeaf {
  // dot/bracket path, e.g. `checkout.payment.cta` or `nav.items.0.label`
  path: string
  value: string
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

function isPlainObject(v: unknown): v is { [k: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Walk an object and collect every leaf that is a STRING, in document order.
// Non-string leaves (numbers, booleans, null) are intentionally skipped — they are
// never translatable and are copied straight from English on export.
export function flattenStrings(obj: Json, prefix = ''): JsonLeaf[] {
  const out: JsonLeaf[] = []
  const walk = (node: Json, path: string) => {
    if (typeof node === 'string') {
      out.push({ path, value: node })
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i)))
    } else if (isPlainObject(node)) {
      for (const key of Object.keys(node)) {
        walk(node[key], path ? `${path}.${key}` : key)
      }
    }
    // numbers/booleans/null: not translatable, ignored
  }
  walk(obj, prefix)
  return out
}

// Read the string value at a given path out of a parsed object. Returns undefined if
// the path is absent or doesn't resolve to a string (so callers can fall back).
export function getStringAtPath(obj: Json, path: string): string | undefined {
  const parts = path.split('.')
  let cur: Json = obj
  for (const part of parts) {
    if (Array.isArray(cur)) {
      const idx = Number(part)
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return undefined
      cur = cur[idx]
    } else if (isPlainObject(cur)) {
      if (!(part in cur)) return undefined
      cur = cur[part]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

// Set a string value at a path inside an object that already has the English shape.
function setStringAtPath(obj: Json, path: string, value: string): void {
  const parts = path.split('.')
  let cur: Json = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (Array.isArray(cur)) cur = cur[Number(part)]
    else if (isPlainObject(cur)) cur = cur[part]
    else return
  }
  const last = parts[parts.length - 1]
  if (Array.isArray(cur)) cur[Number(last)] = value
  else if (isPlainObject(cur)) cur[last] = value
}

export interface StructureMismatch {
  missingInTarget: string[] // string paths in English absent from the target
  extraInTarget: string[] // string paths in the target not present in English
}

// Compare English vs. a target file's string paths (brief FR-5). Advisory only.
export function compareStructure(englishText: string, targetText: string): StructureMismatch {
  const en = new Set(flattenStrings(JSON.parse(englishText)).map((l) => l.path))
  const tg = new Set(flattenStrings(JSON.parse(targetText)).map((l) => l.path))
  const missingInTarget: string[] = []
  const extraInTarget: string[] = []
  for (const p of en) if (!tg.has(p)) missingInTarget.push(p)
  for (const p of tg) if (!en.has(p)) extraInTarget.push(p)
  return { missingInTarget, extraInTarget }
}

// Rebuild a target-language file from the English structure (brief §8.1).
//   - deep-clone English (defines canonical shape, key order, non-string leaves)
//   - for each English string leaf, set: edit -> original target value -> fallback
//   - serialize 2-space, UTF-8, unescaped Unicode, trailing newline
//
// `edits` and `originalTarget` are maps keyed by string path.
export function rebuildTargetJson(
  englishText: string,
  originalTarget: Map<string, string>,
  edits: Map<string, string>,
  fillUntranslatedWithEnglish: boolean,
): string {
  const english: Json = JSON.parse(englishText)
  const clone: Json = JSON.parse(englishText) // deep clone via re-parse
  for (const leaf of flattenStrings(english)) {
    let value: string
    if (edits.has(leaf.path)) {
      value = edits.get(leaf.path)!
    } else if (originalTarget.has(leaf.path)) {
      value = originalTarget.get(leaf.path)!
    } else {
      value = fillUntranslatedWithEnglish ? leaf.value : ''
    }
    setStringAtPath(clone, leaf.path, value)
  }
  // JSON.stringify emits non-ASCII unescaped by default; 2-space indent; add newline.
  return JSON.stringify(clone, null, 2) + '\n'
}

// Build a minimal "changes-only" patch for handoff to a coding agent (e.g. Devin):
// a nested partial of the target file containing ONLY the keys whose value was edited
// (differs from the originally loaded target). It mirrors the English structure so it
// deep-merges cleanly into the repo's locale file, and — because untranslated keys are
// never included — it can't introduce blank strings. An array that contains any change
// is emitted whole (valid JSON, never sparse). Returns null if nothing changed.
export function buildChangesPatch(
  englishText: string,
  originalTarget: Map<string, string>,
  edits: Map<string, string>,
): { patch: Json; changedCount: number } | null {
  const changed = new Set<string>()
  for (const [path, value] of edits) {
    if ((originalTarget.get(path) ?? '') !== value) changed.add(path)
  }
  if (changed.size === 0) return null

  const english: Json = JSON.parse(englishText)
  const currentVal = (path: string): string => (edits.has(path) ? edits.get(path)! : originalTarget.get(path) ?? '')
  const changedUnder = (prefix: string): boolean => {
    for (const c of changed) if (c === prefix || c.startsWith(prefix + '.')) return true
    return false
  }

  // Rebuild an entire subtree with current values (used when an array has a change).
  const buildSubtree = (node: Json, path: string): Json => {
    if (typeof node === 'string') return currentVal(path)
    if (Array.isArray(node)) return node.map((c, i) => buildSubtree(c, path ? `${path}.${i}` : String(i)))
    if (isPlainObject(node)) {
      const o: { [k: string]: Json } = {}
      for (const k of Object.keys(node)) o[k] = buildSubtree(node[k], path ? `${path}.${k}` : k)
      return o
    }
    return node
  }

  const prune = (node: Json, path: string): { include: boolean; value: Json } => {
    if (typeof node === 'string') return { include: changed.has(path), value: currentVal(path) }
    if (Array.isArray(node)) {
      return changedUnder(path) ? { include: true, value: buildSubtree(node, path) } : { include: false, value: null }
    }
    if (isPlainObject(node)) {
      const o: { [k: string]: Json } = {}
      let any = false
      for (const k of Object.keys(node)) {
        const r = prune(node[k], path ? `${path}.${k}` : k)
        if (r.include) {
          o[k] = r.value
          any = true
        }
      }
      return { include: any, value: o }
    }
    return { include: false, value: null }
  }

  return { patch: prune(english, '').value, changedCount: changed.size }
}

// Parse a target file into a path->string map of its string leaves.
export function targetValueMap(targetText: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const leaf of flattenStrings(JSON.parse(targetText))) map.set(leaf.path, leaf.value)
  return map
}
