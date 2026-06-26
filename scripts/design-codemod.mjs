// One-shot codemod: migrate old design tokens → new Industrious-polished tokens.
// Operates on src/**/*.{tsx,ts}. globals.css is rewritten separately by hand.
// Ordered replacements — specific before generic. See MIGRATION.md.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = 'src'

// [pattern (string=plain, RegExp=regex), replacement]
const RULES = [
  // ── Status families: do -border and -text BEFORE the bare bg name ──
  ['status-pass-border', 'pass-line'],
  ['status-pass-text', 'pass'],
  ['status-pass', 'pass-soft'],
  ['status-fail-border', 'fail-line'],
  ['status-fail-text', 'fail'],
  ['status-fail', 'fail-soft'],
  ['status-blocked-border', 'blocked-line'],
  ['status-blocked-text', 'blocked'],
  ['status-blocked', 'blocked-soft'],
  ['status-skipped-border', 'skipped-line'],
  ['status-skipped-text', 'skipped'],
  ['status-skipped', 'skipped-soft'],

  // ── Neutrals / ink ──
  ['warm-border', 'line'],
  ['ink-2', 'ink-soft'],
  ['ink-3', 'ink-muted'],

  // ── Accents / surfaces (prefixed, word-bounded to avoid false hits) ──
  [/-sand\b/g, '-almond-400'],
  [/-mist\b/g, '-info'],
  [/-gold\b/g, '-accent'],

  // ── Radius: collapse the bracket sprawl onto tokens ──
  ['rounded-[6px]', 'rounded-xs'],
  ['rounded-[8px]', 'rounded-xs'],
  ['rounded-[10px]', 'rounded-sm'],
  ['rounded-[12px]', 'rounded-md'],
  ['rounded-[14px]', 'rounded-md'],
  ['rounded-[16px]', 'rounded-lg'],
  ['rounded-2xl', 'rounded-lg'],

  // ── Container widths → 3-width system ──
  ['max-w-md', 'max-w-prose'],
  ['max-w-2xl', 'max-w-content'],
  ['max-w-3xl', 'max-w-content'],
  ['max-w-5xl', 'max-w-wide'],
  ['max-w-[1400px]', 'max-w-wide'],

  // ── Stray arbitrary hex (translation chip editor) ──
  ['bg-[#FEF2F2]', 'bg-fail-soft'],
  ['bg-[#FCF6EC]', 'bg-sunken'],
]

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(name)) acc.push(p)
  }
  return acc
}

function replaceAll(str, pat, rep) {
  if (pat instanceof RegExp) return str.replace(pat, rep)
  return str.split(pat).join(rep)
}

let changed = 0
const files = walk(ROOT)
for (const f of files) {
  const before = readFileSync(f, 'utf8')
  let after = before
  for (const [pat, rep] of RULES) after = replaceAll(after, pat, rep)
  if (after !== before) {
    writeFileSync(f, after)
    changed++
  }
}
console.log(`codemod: scanned ${files.length} files, modified ${changed}`)
