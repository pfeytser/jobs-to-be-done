/**
 * Local worker: search connected Gmail accounts for receipts matching unmatched
 * expense transactions, store receipt PDFs in Vercel Blob, and record matches.
 *
 * Run:  npx tsx scripts/match-gmail-receipts.ts [flags]
 *
 * Flags:
 *   --dry-run            search + score + log, write nothing
 *   --max=N              max expenses this run (default 50)
 *   --before=N           date window days before expense_date (default 3)
 *   --after=N            date window days after expense_date (default 7)
 *   --auto=N             auto-match threshold 0-100 (default 85)
 *   --possible=N         possible-match threshold 0-100 (default 60)
 *   --floor=N            minimum score to record a candidate (default 45)
 *   --per-query=N        Gmail messages fetched per query (default 12)
 *   --stale-hours=N      only re-search expenses not searched in the last N hours
 *   --no-skip            disable the no-receipt skip list
 *
 * Requires env (loaded from .env.local): TURSO_CONNECTION_URL, TURSO_AUTH_TOKEN,
 * BLOB_READ_WRITE_TOKEN, GOOGLE_RECEIPT_CLIENT_ID/SECRET/REDIRECT_URI, and either
 * RECEIPT_TOKEN_KEY or NEXTAUTH_SECRET.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env.local before importing anything that reads env at module load.
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

function flag(name: string): string | undefined {
  const pref = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(pref))
  return hit ? hit.slice(pref.length) : undefined
}
function has(name: string): boolean {
  return process.argv.includes(`--${name}`)
}
function num(name: string, def: number): number {
  const v = flag(name)
  if (v == null) return def
  const n = Number(v)
  return Number.isNaN(n) ? def : n
}

async function main() {
  const { runMatching, DEFAULT_CONFIG } = await import('@/lib/expenses/engine')
  const { DEFAULT_SKIP_RULES } = await import('@/lib/expenses/scoring')

  const dryRun = has('dry-run')
  const staleHours = flag('stale-hours')

  const cfg = {
    ...DEFAULT_CONFIG,
    maxExpensesPerRun: num('max', DEFAULT_CONFIG.maxExpensesPerRun),
    dateWindowBeforeDays: num('before', DEFAULT_CONFIG.dateWindowBeforeDays),
    dateWindowAfterDays: num('after', DEFAULT_CONFIG.dateWindowAfterDays),
    autoMatchThreshold: num('auto', DEFAULT_CONFIG.autoMatchThreshold),
    possibleMatchThreshold: num('possible', DEFAULT_CONFIG.possibleMatchThreshold),
    candidateFloor: num('floor', DEFAULT_CONFIG.candidateFloor),
    messagesPerQuery: num('per-query', DEFAULT_CONFIG.messagesPerQuery),
    staleAfterMs: staleHours ? Number(staleHours) * 3_600_000 : undefined,
    dryRun,
    skipRules: has('no-skip')
      ? { bankFees: false, negativeAmounts: false, recurringMembership: false }
      : DEFAULT_SKIP_RULES,
    log: (msg: string) => console.log(msg),
  }

  console.log(`\n=== Gmail receipt matcher ===`)
  console.log(`mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log(
    `window: -${cfg.dateWindowBeforeDays}/+${cfg.dateWindowAfterDays}d · ` +
      `auto>=${cfg.autoMatchThreshold} review>=${cfg.possibleMatchThreshold} floor>=${cfg.candidateFloor} · ` +
      `max ${cfg.maxExpensesPerRun}\n`
  )

  const summary = await runMatching(cfg)

  console.log(`\n=== Run summary ===`)
  console.log(`accounts:`)
  for (const a of summary.accounts) {
    console.log(`  ${a.ok ? '✓' : '✗'} ${a.label} <${a.email}>${a.note ? ` — ${a.note}` : ''}`)
  }
  console.log(`expenses considered : ${summary.expensesConsidered}`)
  console.log(`skipped (no receipt): ${summary.skipped}`)
  console.log(`searched            : ${summary.searched}`)
  console.log(`candidates recorded : ${summary.candidatesRecorded}`)
  console.log(`receipt files saved : ${summary.filesSaved}`)
  console.log(`auto-matched        : ${summary.autoMatched}`)
  console.log(`needs review        : ${summary.needsReview}`)
  console.log(`contention demotions: ${summary.contentionDemotions}`)
  if (summary.errors.length) {
    console.log(`errors (${summary.errors.length}):`)
    for (const e of summary.errors.slice(0, 20)) console.log(`  - ${e}`)
  }
  console.log(`\nDone.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FAILED:', e)
    process.exit(1)
  })
