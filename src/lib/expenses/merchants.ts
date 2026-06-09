// Coupa merchant descriptors are noisy card-network strings: processor prefixes
// (TST*, SQ *, PY *, DD *), truncation, store numbers, locations. This module turns
// them into clean tokens and, where known, a canonical vendor + sender domains —
// because matching a Gmail sender domain (uber.com) is far more reliable than the
// garbled descriptor.

export interface MerchantProfile {
  raw: string
  canonical: string // best-guess clean vendor name (lowercase)
  tokens: string[] // significant search tokens (lowercase)
  senderDomains: string[] // likely From: domains for this vendor
}

// Processor / POS prefixes to strip from the front of a descriptor.
const PROCESSOR_PREFIXES = [
  'tst*', 'tst *', 'sq *', 'sq*', 'py *', 'py*', 'dd *', 'dd*',
  'dnh*', 'wpy*', 'ppy*', 'paypal *', 'paypal*', 'in *', 'in*',
]

// Known vendor aliases keyed by a substring that appears in the descriptor.
// canonical + domains drive the high-confidence sender-domain match.
const ALIASES: { match: RegExp; canonical: string; domains: string[]; tokens?: string[] }[] = [
  { match: /\buber\s*eats|ubereats\b/i, canonical: 'uber eats', domains: ['uber.com'], tokens: ['uber', 'eats'] },
  { match: /\buber\b|uber\s*\*?trip|uber canada/i, canonical: 'uber', domains: ['uber.com'] },
  // Lyft sends ride receipts from lyftmail.com, not lyft.com — the original miss.
  { match: /\blyft\b/i, canonical: 'lyft', domains: ['lyftmail.com', 'lyft.com', 'email.lyft.com'] },
  { match: /\bamtrak\b/i, canonical: 'amtrak', domains: ['amtrak.com'] },
  { match: /\balamo\b/i, canonical: 'alamo', domains: ['goalamo.com'] },
  { match: /air\s*can|air canada/i, canonical: 'air canada', domains: ['aircanada.com', 'aircanada.ca'] },
  { match: /\bunited\b|ua inflt|ua\b/i, canonical: 'united airlines', domains: ['united.com'] },
  { match: /\bsouthwest\b|swa inflight|swa\b/i, canonical: 'southwest', domains: ['southwest.com'] },
  { match: /\bdoordash\b/i, canonical: 'doordash', domains: ['doordash.com'] },
  { match: /\banthropic\b/i, canonical: 'anthropic', domains: ['anthropic.com'] },
  { match: /\bopenai\b|chatgpt/i, canonical: 'openai', domains: ['openai.com'] },
  { match: /claude\.ai/i, canonical: 'claude', domains: ['anthropic.com'] },
  { match: /\bvercel\b/i, canonical: 'vercel', domains: ['vercel.com'] },
  { match: /\bwpengine\b/i, canonical: 'wp engine', domains: ['wpengine.com'] },
  { match: /lottielab/i, canonical: 'lottielab', domains: ['lottielab.com'] },
  { match: /\bsweetgreen\b/i, canonical: 'sweetgreen', domains: ['sweetgreen.com'] },
  { match: /trivago/i, canonical: 'trivago', domains: ['trivago.com'] },
  { match: /njtransit|nj transit/i, canonical: 'nj transit', domains: ['njtransit.com'] },
  { match: /amazon/i, canonical: 'amazon', domains: ['amazon.com'] },
  { match: /industrious/i, canonical: 'industrious', domains: ['industriousoffice.com'] },
]

const STOPWORDS = new Set([
  'the', 'inc', 'llc', 'co', 'corp', 'com', 'ltd', 'trip', 'ride', 'inflt', 'inflight',
  'store', 'card', 'ending', 'in', 'subscription', 'subscr', 'www',
])

const DAY_TOKENS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

function stripPrefixes(s: string): string {
  let out = s.trim()
  const lower = out.toLowerCase()
  for (const p of PROCESSOR_PREFIXES) {
    if (lower.startsWith(p)) {
      out = out.slice(p.length).trim()
      break
    }
  }
  return out
}

export function buildMerchantProfile(rawMerchant: string): MerchantProfile {
  const raw = (rawMerchant ?? '').trim()
  const stripped = stripPrefixes(raw)

  const alias = ALIASES.find((a) => a.match.test(raw))
  const canonical = alias ? alias.canonical : stripped.toLowerCase()

  // Tokenize: drop the leading processor noise, split on non-alphanumerics,
  // remove stopwords / day-of-week / pure-number / 1-char tokens.
  const base = (alias?.tokens?.join(' ') ?? stripped).toLowerCase()
  const tokens = Array.from(
    new Set(
      base
        .split(/[^a-z0-9]+/i)
        .map((t) => t.trim())
        .filter(
          (t) =>
            t.length >= 2 &&
            !STOPWORDS.has(t) &&
            !DAY_TOKENS.has(t) &&
            !/^\d+$/.test(t)
        )
    )
  )

  return {
    raw,
    canonical,
    tokens: tokens.length ? tokens : [canonical].filter(Boolean),
    senderDomains: alias?.domains ?? [],
  }
}

// True if any sender domain for the merchant appears in a From: header.
export function senderDomainMatches(profile: MerchantProfile, from: string): boolean {
  if (!from) return false
  const lower = from.toLowerCase()
  return profile.senderDomains.some((d) => lower.includes(d))
}

// Weak/strong token presence in a blob of text (subject/body/from).
export function merchantTokenScore(profile: MerchantProfile, text: string): number {
  if (!text) return 0
  const lower = text.toLowerCase()
  const hits = profile.tokens.filter((t) => lower.includes(t)).length
  if (hits === 0) return 0
  return hits / profile.tokens.length // 0..1 fraction of tokens present
}
