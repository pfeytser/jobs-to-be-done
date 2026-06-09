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

// Parse a target file into a path->string map of its string leaves.
export function targetValueMap(targetText: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const leaf of flattenStrings(JSON.parse(targetText))) map.set(leaf.path, leaf.value)
  return map
}
