// Surgical: add Newsreader (`font-display`) + `tracking-tight` to page-title
// <h1> elements only (never the stat-number <p>/<div> that share title classes).
// Skips h1s that already have font-display.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (/\.(tsx)$/.test(name)) acc.push(p)
  }
  return acc
}

let changed = 0
for (const f of walk('src')) {
  const before = readFileSync(f, 'utf8')
  const after = before
    .split('\n')
    .map((line) => {
      if (!line.includes('<h1') || !line.includes('className="')) return line
      if (line.includes('font-display')) return line
      const inject = line.includes('tracking-tight') ? 'font-display ' : 'font-display tracking-tight '
      return line.replace('className="', `className="${inject}`)
    })
    .join('\n')
  if (after !== before) {
    writeFileSync(f, after)
    changed++
  }
}
console.log('title codemod: modified', changed, 'files')
