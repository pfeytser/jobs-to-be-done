// Phase 4 codemod: map remaining raw Tailwind palette colors → brand tokens.
// Keys sorted by length desc so e.g. bg-red-500 is replaced before bg-red-50.
// Gradient stops (from-/to-) are intentionally excluded — the gradient pages
// (auth signin/error) are hand-restyled. Our own ui/ components use teal-*/
// ring-teal-* which are NOT remapped, so they're untouched.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const MAP = {
  // red → fail
  'text-red-700': 'text-fail', 'text-red-600': 'text-fail', 'text-red-500': 'text-fail',
  'bg-red-50': 'bg-fail-soft',
  'bg-red-600': 'bg-fail', 'bg-red-500': 'bg-fail', 'bg-red-400': 'bg-fail', 'bg-red-300': 'bg-fail',
  'border-red-200': 'border-fail-line',
  // gray → ink / line / surfaces
  'text-gray-900': 'text-ink', 'text-gray-700': 'text-ink-soft', 'text-gray-600': 'text-ink-soft',
  'text-gray-500': 'text-ink-muted', 'text-gray-400': 'text-ink-muted',
  'bg-gray-100': 'bg-sunken', 'bg-gray-50': 'bg-canvas',
  'border-gray-300': 'border-line', 'border-gray-200': 'border-line',
  // amber / yellow → blocked / accent
  'bg-amber-50': 'bg-blocked-soft', 'bg-amber-500': 'bg-accent', 'bg-amber-600': 'bg-accent',
  'text-amber-700': 'text-blocked', 'text-amber-600': 'text-blocked',
  'border-amber-200': 'border-blocked-line',
  'bg-yellow-100': 'bg-blocked-soft', 'text-yellow-800': 'text-blocked',
  // green → pass
  'text-green-800': 'text-pass', 'text-green-600': 'text-pass', 'text-green-500': 'text-pass',
  'bg-green-100': 'bg-pass-soft', 'bg-green-500': 'bg-pass',
  // blue → info / ink
  'bg-blue-100': 'bg-info', 'text-blue-800': 'text-ink-soft',
  // white card surfaces
  'bg-white': 'bg-surface',
}

const keys = Object.keys(MAP).sort((a, b) => b.length - a.length)

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(name)) acc.push(p)
  }
  return acc
}

let changed = 0
for (const f of walk('src')) {
  const before = readFileSync(f, 'utf8')
  let after = before
  for (const k of keys) after = after.split(k).join(MAP[k])
  if (after !== before) {
    writeFileSync(f, after)
    changed++
  }
}
console.log('color codemod: modified', changed, 'files')
