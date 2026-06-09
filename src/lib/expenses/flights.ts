import { stripHtml } from './scoring'
import type { ParsedGmailMessage } from './gmail'

// Known airlines: sender domains (for precise Gmail search) + a name regex (to label
// emails that arrive via an OTA or a domain we didn't list).
// `re` is the fallback name match for emails NOT from a known airline domain. It must
// be airline-specific — bare words like "united"/"delta" match "United States",
// "Delta Dental", etc., so require the full carrier name.
export const AIRLINES: { name: string; domains: string[]; re: RegExp }[] = [
  { name: 'United', domains: ['united.com'], re: /united airlines/i },
  { name: 'American Airlines', domains: ['aa.com', 'americanairlines.com'], re: /american airlines/i },
  { name: 'Delta', domains: ['delta.com'], re: /delta air\s?lines/i },
  { name: 'Southwest', domains: ['southwest.com'], re: /southwest/i },
  { name: 'Air Canada', domains: ['aircanada.com', 'aircanada.ca'], re: /air canada/i },
  { name: 'JetBlue', domains: ['jetblue.com'], re: /jetblue/i },
  { name: 'Alaska Airlines', domains: ['alaskaair.com'], re: /alaska airlines/i },
  { name: 'Spirit', domains: ['spirit.com'], re: /spirit airlines/i },
  { name: 'Frontier', domains: ['flyfrontier.com'], re: /frontier airlines/i },
  { name: 'WestJet', domains: ['westjet.com'], re: /westjet/i },
  { name: 'Porter', domains: ['flyporter.com'], re: /porter airlines/i },
  { name: 'Lufthansa', domains: ['lufthansa.com'], re: /lufthansa/i },
  { name: 'British Airways', domains: ['britishairways.com'], re: /british airways/i },
  { name: 'Air France', domains: ['airfrance.com', 'airfrance.fr'], re: /air france/i },
  { name: 'KLM', domains: ['klm.com'], re: /\bklm\b/i },
  { name: 'Emirates', domains: ['emirates.com'], re: /emirates/i },
]

export function allAirlineDomains(): string[] {
  return Array.from(new Set(AIRLINES.flatMap((a) => a.domains)))
}

// Substrings that identify each airline in a Coupa expense merchant string, so a
// trip is only considered "expensed" if a matching-airline air-travel charge exists.
const AIRLINE_MERCHANT_TOKENS: Record<string, string[]> = {
  United: ['united', 'ua '],
  'American Airlines': ['american', 'aa '],
  Delta: ['delta'],
  Southwest: ['southwest', 'swa'],
  'Air Canada': ['air can', 'aircan'],
  JetBlue: ['jetblue'],
  'Alaska Airlines': ['alaska'],
  Spirit: ['spirit'],
  Frontier: ['frontier'],
  WestJet: ['westjet'],
  Porter: ['porter'],
  Lufthansa: ['lufthansa'],
  'British Airways': ['british airways', 'british a'],
  'Air France': ['air france', 'airfrance'],
  KLM: ['klm'],
  Emirates: ['emirates'],
}

// Given a trip's airlines (comma-joined), returns merchant substrings to match
// against expense_transactions. Empty when no airline is recognized.
export function airlineMerchantTokens(airlines: string): string[] {
  const out = new Set<string>()
  for (const name of airlines.split(',').map((s) => s.trim())) {
    for (const tok of AIRLINE_MERCHANT_TOKENS[name] ?? []) out.add(tok)
  }
  return Array.from(out)
}

const MARKETING_MARKERS = [
  'unsubscribe', '% off', 'sale', 'earn miles', 'credit card', 'deal of', 'fare sale',
  'save up to', 'limited time', 'book now and save',
]

const CONFIRMATION_RE =
  /(?:confirmation(?:\s*(?:number|code|#))?|record locator|booking reference|reservation code|pnr)\s*[:#-]?\s*([A-Z0-9]{5,7})\b/i
const ROUTE_RE = /\b([A-Z]{3})\b\s*(?:to|-|–|—|→|>|✈)\s*\b([A-Z]{3})\b/
// Fare extraction: only trust a currency amount that sits next to a fare label
// ("total", "fare", "amount paid", etc.). Airline emails are full of large numbers
// (travel credits, points, ticket numbers) that aren't the fare, so we do NOT take
// the max of all currency amounts — only labeled ones, capped to a plausible range.
const LABELED_FARE_RE =
  /(?:fare\s*total|trip\s*(?:cost|total)|grand\s*total|amount\s*(?:paid|charged|due)|total\s*(?:cost|charged|paid|fare|price)?|you\s*paid|total)\b[^$€£\d]{0,40}(?:US\$|USD|CA\$|CAD|\$|€|£)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/gi

function fareAmount(text: string): number | null {
  const vals: number[] = []
  for (const m of text.matchAll(LABELED_FARE_RE)) {
    const n = parseFloat(m[1].replace(/,/g, ''))
    if (!Number.isNaN(n) && n > 0 && n <= 10000) vals.push(n)
  }
  return vals.length ? Math.max(...vals) : null
}
const MONTH_DATE_RE =
  /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i

export interface FlightExtract {
  airline: string
  confirmationCode: string | null
  route: string | null
  travelDate: string | null // ISO yyyy-mm-dd, best-effort
  amount: number | null
  isFlight: boolean
}

// Three-letter tokens that look like airport codes but aren't (carrier/boilerplate
// words common in airline emails).
const NON_AIRPORT = new Set(['SWA', 'FLY', 'ALL', 'THE', 'AND', 'USD', 'CAD', 'EUR', 'GBP', 'PDF', 'ETA', 'TSA', 'PNR', 'NEW', 'YOU', 'NON', 'WWW', 'UTC', 'GMT'])

function extractRoute(text: string): string | null {
  const m = text.match(ROUTE_RE)
  if (!m) return null
  const [, a, b] = m
  if (a === b || NON_AIRPORT.has(a) || NON_AIRPORT.has(b)) return null
  return `${a}→${b}`
}

function fromDomain(from: string): string {
  const m = from.toLowerCase().match(/@([a-z0-9.-]+)/)
  return m ? m[1] : ''
}

// Airline identified by the SENDER domain — high confidence the email is from the
// airline itself.
function airlineFromDomain(from: string): string | null {
  const domain = fromDomain(from)
  for (const a of AIRLINES) {
    if (a.domains.some((d) => domain.endsWith(d))) return a.name
  }
  return null
}

// Airline identified by name in the text — used for OTA/forwarded mail not sent
// from an airline domain. Requires the full carrier name (see AIRLINES.re).
function airlineFromName(text: string): string | null {
  for (const a of AIRLINES) {
    if (a.re.test(text)) return a.name
  }
  return null
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function extractTravelDate(text: string): string | null {
  const m = text.match(MONTH_DATE_RE)
  if (!m) return null
  if (m[1]) {
    // "12 Apr 2026"
    return `${m[3]}-${MONTHS[m[2].toLowerCase().slice(0, 3)]}-${m[1].padStart(2, '0')}`
  }
  // "Apr 12, 2026"
  return `${m[6]}-${MONTHS[m[4].toLowerCase().slice(0, 3)]}-${m[5].padStart(2, '0')}`
}

// Analyzes a Gmail message and decides whether it's a flight confirmation, plus
// extracts the airline, confirmation code, route, travel date, and fare.
export function extractFlight(msg: ParsedGmailMessage): FlightExtract {
  const body = `${msg.text}\n${stripHtml(msg.html)}`
  const hay = `${msg.subject}\n${body}`
  const lower = hay.toLowerCase()

  const airlineDom = airlineFromDomain(msg.from)
  const airlineName = airlineFromName(hay)
  const airline = airlineDom ?? airlineName
  const code = hay.match(CONFIRMATION_RE)?.[1]?.toUpperCase() ?? null
  const route = extractRoute(hay)
  const travelDate = extractTravelDate(body) ?? (msg.dateIso ? msg.dateIso.slice(0, 10) : null)
  const amount = fareAmount(body)

  const looksMarketing = MARKETING_MARKERS.some((k) => lower.includes(k))
  const subjectLower = msg.subject.toLowerCase()
  // Airline mail that is NOT a flight itinerary — explicitly excluded (seat changes,
  // aircraft-info notices, wifi, miles statements, surveys, etc.).
  const NEGATIVE_SUBJECT =
    /account information|mileageplus|skymiles|rapid rewards (statement|account)|tell us how|how did we do|wi-?fi|entertainment options|what to know|travel tips|trusted travel|miles? (expir|balance)|points? (expir|balance)|survey|feedback|newsletter|don'?t miss the bus|offsite (registration|transportation)|seat change|aircraft information|plan ahead|construction/i
  const strongSubject =
    /itinerary|e-?ticket|boarding pass|booking confirmation|trip confirmation|reservation confirmation|flight .*confirmation|booking reference|you'?re going to|check in/i.test(
      subjectLower
    )

  // A real flight email: it's airline-related (named airline or airport route) AND
  // it's actually a booking (a confirmation code, a route, or a strong itinerary
  // subject). With airline detection requiring the full carrier name, a conference-
  // room "Booking Confirmation" that merely says "United States" no longer qualifies.
  const isFlight =
    !NEGATIVE_SUBJECT.test(subjectLower) &&
    !(looksMarketing && !code) &&
    (!!airline || !!route) &&
    (!!code || !!route || strongSubject)

  return {
    airline: airline ?? 'Unknown airline',
    confirmationCode: code,
    route,
    travelDate,
    amount,
    isFlight,
  }
}

// Stable trip grouping key: confirmation code groups round-trips/multi-leg under one
// trip; codeless emails become their own singleton trip. Deterministic across
// re-scans, so user trip categories are preserved.
export function tripKeyFor(
  extract: FlightExtract,
  emailAccountId: string,
  gmailMessageId: string
): string {
  if (extract.confirmationCode) return `code:${extract.confirmationCode}`
  return `msg:${emailAccountId}:${gmailMessageId}`
}
