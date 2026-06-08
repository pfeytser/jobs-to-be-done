// Amount extraction for receipt MATCHING. This is deliberately separate from the
// import-time parseAmount() in columns.ts: that one strips all non-[0-9.] which
// corrupts locale formats (it would turn "123,45" into "12345"). Here we must
// recognize many on-receipt formats and return candidate numeric values to compare.

// Matches money-like tokens, optionally with a currency symbol/code, in US or
// European grouping. Examples: 123.45  $123.45  USD 123.45  €1.234,56  £99  1,234.56
const MONEY_RE =
  /(?:US\$|USD|EUR|CAD|GBP|AUD|\$|€|£)?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi

// Normalizes a single matched numeric string (without currency) to a Number,
// inferring US vs European decimal convention.
function normalizeNumber(s: string): number | null {
  let t = s.trim()
  if (!t) return null

  const hasComma = t.includes(',')
  const hasDot = t.includes('.')

  if (hasComma && hasDot) {
    // Whichever separator is last is the decimal separator.
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) {
      // European: dot = thousands, comma = decimal → 1.234,56
      t = t.replace(/\./g, '').replace(',', '.')
    } else {
      // US: comma = thousands → 1,234.56
      t = t.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Only commas. "123,45" → decimal; "1,234" → thousands.
    const parts = t.split(',')
    if (parts.length === 2 && parts[1].length <= 2) {
      t = `${parts[0]}.${parts[1]}` // decimal comma
    } else {
      t = t.replace(/,/g, '') // thousands
    }
  }
  // else: only dots or plain digits — leave as-is.

  const n = parseFloat(t)
  return Number.isNaN(n) ? null : n
}

// Returns the set of distinct numeric amounts found in a text blob.
export function extractAmounts(text: string): number[] {
  if (!text) return []
  const out = new Set<number>()
  for (const m of text.matchAll(MONEY_RE)) {
    const n = normalizeNumber(m[1])
    if (n != null && n > 0) out.add(Math.round(n * 100) / 100)
  }
  return Array.from(out)
}

// True if `target` appears among the extracted amounts within a tiny tolerance
// (rounding only). Compares on absolute value so a -443.00 expense still matches a
// 443.00 receipt.
export function amountPresent(amounts: number[], target: number, tolerance = 0.01): boolean {
  const t = Math.abs(target)
  return amounts.some((a) => Math.abs(a - t) <= tolerance)
}
