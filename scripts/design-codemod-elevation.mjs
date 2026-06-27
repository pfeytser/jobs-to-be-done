// Elevation pass (per designer's ELEVATION-PASS.md), line-scoped & guarded:
//  A) Page-title <h1> weight → Newsreader Light (font-bold/black → font-light) + leading-tight.
//  B) rounded-full → rounded-md on buttons/tabs ONLY. KEEP rounded-full on:
//     avatars/images (object-cover, overflow-hidden), status chips/badges/tag
//     chips (-soft, status bg, py-0.5), status dots & progress bars (small w/h,
//     h-full), and animated indicators.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Lines that must KEEP their rounded-full (chips, avatars, dots, bars).
const KEEP = /object-cover|overflow-hidden|-soft\b|animate-|place-items-center|bg-(pass|fail|blocked|skipped)\b|\b(w|h)-(1|1\.5|2|2\.5|3)\b|h-full|py-0\.5/

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (/\.(tsx)$/.test(name)) acc.push(p)
  }
  return acc
}

let files = 0
let pills = 0
for (const f of walk('src')) {
  const before = readFileSync(f, 'utf8')
  const after = before
    .split('\n')
    .map((line) => {
      // A) editorial title weight on h1s already carrying font-display
      if (line.includes('<h1') && line.includes('font-display')) {
        line = line.replace(/font-black|font-bold/g, 'font-light')
        if (!line.includes('leading-')) line = line.replace('font-display ', 'font-display leading-tight ')
      }
      // B) guarded de-pill
      if (line.includes('rounded-full') && !KEEP.test(line)) {
        pills += (line.match(/rounded-full/g) || []).length
        line = line.split('rounded-full').join('rounded-md')
      }
      return line
    })
    .join('\n')
  if (after !== before) {
    writeFileSync(f, after)
    files++
  }
}
console.log(`elevation codemod: ${files} files, ${pills} rounded-full → rounded-md`)
