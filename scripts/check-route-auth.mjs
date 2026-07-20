#!/usr/bin/env node
// Fails the build if any API route handler does not perform an auth check.
// This enforces security invariant #1 (see CLAUDE.md): every /api route must
// call an auth guard or auth() — the only exceptions are the NextAuth handler
// and the public health check.
//
// Detection is intentionally simple (a substring scan). It cannot prove a check
// is *correct*, only that one is present — a cheap backstop against the most
// common mistake: shipping a route with no authorization at all.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const API_DIR = 'src/app/api'

// Routes that are intentionally public.
const PUBLIC_ALLOWLIST = [
  'src/app/api/auth/[...nextauth]/route.ts',
  'src/app/api/health/route.ts',
]

// Any of these tokens counts as "this route authorizes itself".
const AUTH_MARKERS = ['requireUser', 'requireAdmin', 'requireExpenseOwner', 'auth()']

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name === 'route.ts') out.push(p)
  }
  return out
}

const offenders = []
for (const file of walk(API_DIR)) {
  if (PUBLIC_ALLOWLIST.includes(file)) continue
  const src = readFileSync(file, 'utf8')
  if (!AUTH_MARKERS.some((m) => src.includes(m))) offenders.push(file)
}

if (offenders.length) {
  console.error('\n❌ Route(s) missing an auth check (see CLAUDE.md invariant #1):')
  for (const f of offenders) console.error('   - ' + f)
  console.error(
    '\nAdd requireUser()/requireAdmin()/requireExpenseOwner() from src/lib/auth/guards.ts,\n' +
      'or add the route to PUBLIC_ALLOWLIST in scripts/check-route-auth.mjs if it is intentionally public.\n'
  )
  process.exit(1)
}

console.log('✅ All API routes perform an auth check.')
