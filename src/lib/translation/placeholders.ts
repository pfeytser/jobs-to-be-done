// Advisory placeholder / token detection (brief §8.3).
//
// We extract the tokens that must survive translation and flag any that are present
// in the English source but dropped from a non-empty translation. This is ADVISORY:
// a naive brace scan throws false positives on ICU plural/select branches (the
// human-readable words inside `{count, plural, =1 {...} other {...}}` look like
// tokens). We never block on it; we only surface a warning.

const PATTERNS: RegExp[] = [
  /\{\{\s*[^{}]+?\s*\}\}/g, // {{var}} (mustache / i18next)
  /%[sd]/g, // printf-style %s %d
  /<\/?[a-zA-Z][^>]*?>/g, // HTML / markup tags <link> <strong> <br/>
  /\]\([^)]+\)/g, // markdown link target ](url)
  /\{[^{}]+\}/g, // single-brace {var} and ICU constructs (noisy, advisory)
]

// Returns a sorted multiset (as a flat array) of tokens found in `text`.
export function extractTokens(text: string): string[] {
  if (!text) return []
  const found: string[] = []
  // Mask out double-brace matches first so {{x}} isn't also counted as {x}.
  let masked = text
  const dbl = text.match(PATTERNS[0]) ?? []
  for (const m of dbl) {
    found.push(m)
    masked = masked.replace(m, ' '.repeat(m.length))
  }
  for (let i = 1; i < PATTERNS.length; i++) {
    const matches = masked.match(PATTERNS[i]) ?? []
    found.push(...matches)
  }
  return found.sort()
}

// Tokens present in `english` (by count) that are missing from `translation`.
// Returns [] when the translation is empty (untranslated isn't a token-drop warning).
export function missingTokens(english: string, translation: string): string[] {
  if (!translation.trim()) return []
  const want = extractTokens(english)
  if (want.length === 0) return []
  const have = extractTokens(translation)
  const haveCount = new Map<string, number>()
  for (const t of have) haveCount.set(t, (haveCount.get(t) ?? 0) + 1)
  const missing: string[] = []
  for (const t of want) {
    const n = haveCount.get(t) ?? 0
    if (n > 0) haveCount.set(t, n - 1)
    else missing.push(t)
  }
  return missing
}
