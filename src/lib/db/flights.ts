import { turso } from './client'
import { runMigrations } from './migrations'
import { airlineMerchantTokens } from '@/lib/expenses/flights'

export type TripCategory = 'uncategorized' | 'business' | 'personal'

export interface FlightEmail {
  id: string
  email_account_id: string
  gmail_message_id: string
  gmail_thread_id: string | null
  rfc822_message_id: string | null
  airline: string
  confirmation_code: string | null
  travel_date: string | null
  route: string | null
  amount: number | null
  currency: string | null
  gmail_subject: string | null
  gmail_from: string | null
  gmail_date: string | null
  trip_key: string
  created_at: string
  updated_at: string
  account_email?: string // the connected inbox this email lives in (for deep links)
}

export interface FlightTrip {
  id: string
  trip_key: string
  label: string
  start_date: string | null
  end_date: string | null
  airlines: string
  category: TripCategory
  created_at: string
  updated_at: string
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function parseEmail(r: Record<string, unknown>): FlightEmail {
  return {
    id: r.id as string,
    email_account_id: r.email_account_id as string,
    gmail_message_id: r.gmail_message_id as string,
    gmail_thread_id: (r.gmail_thread_id as string) ?? null,
    rfc822_message_id: (r.rfc822_message_id as string) ?? null,
    airline: (r.airline as string) ?? '',
    confirmation_code: (r.confirmation_code as string) ?? null,
    travel_date: (r.travel_date as string) ?? null,
    route: (r.route as string) ?? null,
    amount: num(r.amount),
    currency: (r.currency as string) ?? null,
    gmail_subject: (r.gmail_subject as string) ?? null,
    gmail_from: (r.gmail_from as string) ?? null,
    gmail_date: (r.gmail_date as string) ?? null,
    trip_key: (r.trip_key as string) ?? '',
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }
}

function parseTrip(r: Record<string, unknown>): FlightTrip {
  return {
    id: r.id as string,
    trip_key: r.trip_key as string,
    label: (r.label as string) ?? '',
    start_date: (r.start_date as string) ?? null,
    end_date: (r.end_date as string) ?? null,
    airlines: (r.airlines as string) ?? '',
    category: (r.category as TripCategory) ?? 'uncategorized',
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }
}

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// Upsert a detected flight email, deduped by (account, message). Returns true if newly inserted.
export async function upsertFlightEmail(data: {
  email_account_id: string
  gmail_message_id: string
  gmail_thread_id: string | null
  rfc822_message_id: string | null
  airline: string
  confirmation_code: string | null
  travel_date: string | null
  route: string | null
  amount: number | null
  currency: string | null
  gmail_subject: string | null
  gmail_from: string | null
  gmail_date: string | null
  trip_key: string
}): Promise<boolean> {
  await runMigrations()
  const now = new Date().toISOString()
  const existing = await turso.execute({
    sql: 'SELECT id FROM flight_emails WHERE email_account_id = ? AND gmail_message_id = ?',
    args: [data.email_account_id, data.gmail_message_id],
  })
  if (existing.rows[0]) {
    await turso.execute({
      sql: `UPDATE flight_emails SET airline=?, confirmation_code=?, travel_date=?, route=?,
            amount=?, currency=?, gmail_subject=?, gmail_from=?, gmail_date=?, trip_key=?,
            rfc822_message_id=?, updated_at=?
            WHERE id=?`,
      args: [
        data.airline, data.confirmation_code, data.travel_date, data.route, data.amount,
        data.currency, data.gmail_subject, data.gmail_from, data.gmail_date, data.trip_key,
        data.rfc822_message_id, now,
        (existing.rows[0] as Record<string, unknown>).id as string,
      ],
    })
    return false
  }
  await turso.execute({
    sql: `INSERT INTO flight_emails (id, email_account_id, gmail_message_id, gmail_thread_id,
          airline, confirmation_code, travel_date, route, amount, currency, gmail_subject,
          gmail_from, gmail_date, trip_key, rfc822_message_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id('fe'), data.email_account_id, data.gmail_message_id, data.gmail_thread_id, data.airline,
      data.confirmation_code, data.travel_date, data.route, data.amount, data.currency,
      data.gmail_subject, data.gmail_from, data.gmail_date, data.trip_key, data.rfc822_message_id, now, now,
    ],
  })
  return true
}

function airportsOf(route: string | null): string[] {
  if (!route) return []
  return route.split('→').map((s) => s.trim()).filter((s) => /^[A-Z]{3}$/.test(s))
}

function bestDate(e: FlightEmail): string | null {
  return e.travel_date || (e.gmail_date ? e.gmail_date.slice(0, 10) : null)
}

// Rebuilds flight_trips from flight_emails. Two-level grouping:
//   1. Emails → bookings, by confirmation code (so reminder/itinerary/check-in
//      emails for one reservation collapse together).
//   2. Bookings → trips, by destination + month around the home base — so a
//      round trip booked as two one-way codes (SMF→LAS and LAS→SMF) is ONE trip.
// Each email's trip_key is updated to the resulting cluster key. Categories are
// preserved across rebuilds (cluster key is destination+month, stable). Removes
// orphan trips.
export async function rebuildTrips(): Promise<number> {
  await runMigrations()
  const now = new Date().toISOString()
  const emails = (await turso.execute('SELECT * FROM flight_emails')).rows.map((r) =>
    parseEmail(r as Record<string, unknown>)
  )

  // 1. Bookings by confirmation code (codeless emails are their own booking).
  const bookingKeyOf = (e: FlightEmail) =>
    e.confirmation_code ? `code:${e.confirmation_code}` : `msg:${e.email_account_id}:${e.gmail_message_id}`
  const bookings = new Map<string, FlightEmail[]>()
  for (const e of emails) {
    const k = bookingKeyOf(e)
    if (!bookings.has(k)) bookings.set(k, [])
    bookings.get(k)!.push(e)
  }

  // Home base = most frequent airport across all routes (fallback SMF).
  const freq = new Map<string, number>()
  for (const e of emails) for (const ap of airportsOf(e.route)) freq.set(ap, (freq.get(ap) ?? 0) + 1)
  const home = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'SMF'

  // 2. Per-booking away-airports (non-home) + month.
  const bk2 = [...bookings.keys()]
  const info = new Map<string, { away: string[]; month: string | null }>()
  for (const [bk, members] of bookings) {
    const airports = new Set<string>()
    for (const m of members) for (const ap of airportsOf(m.route)) airports.add(ap)
    const dates = members.map(bestDate).filter(Boolean).sort() as string[]
    info.set(bk, { away: [...airports].filter((a) => a !== home), month: dates[0]?.slice(0, 7) ?? null })
  }

  // Union bookings that share an away-airport in the same month — a round trip's
  // out/return one-ways and a connection's legs thus land in one trip.
  const parent = new Map<string, string>(bk2.map((k) => [k, k]))
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(x, r)
    return r
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))
  for (let i = 0; i < bk2.length; i++) {
    for (let j = i + 1; j < bk2.length; j++) {
      const A = info.get(bk2[i])!
      const B = info.get(bk2[j])!
      if (A.month && B.month && A.month === B.month && A.away.some((x) => B.away.includes(x))) {
        union(bk2[i], bk2[j])
      }
    }
  }

  // 3. Stable cluster key per component: combined away-airports + earliest month.
  const components = new Map<string, string[]>()
  for (const bk of bk2) {
    const r = find(bk)
    if (!components.has(r)) components.set(r, [])
    components.get(r)!.push(bk)
  }
  const clusterOf = new Map<string, string>()
  for (const members of components.values()) {
    const away = new Set<string>()
    let month: string | null = null
    for (const bk of members) {
      const inf = info.get(bk)!
      inf.away.forEach((a) => away.add(a))
      if (inf.month && (!month || inf.month < month)) month = inf.month
    }
    const dests = [...away].sort().join('-')
    const key = dests && month ? `trip:${dests}:${month}` : members.slice().sort()[0]
    for (const bk of members) clusterOf.set(bk, key)
  }

  // Reassign each email's trip_key to its cluster key.
  for (const [bk, members] of bookings) {
    const ck = clusterOf.get(bk)!
    for (const m of members) {
      if (m.trip_key !== ck) {
        await turso.execute({
          sql: 'UPDATE flight_emails SET trip_key=?, updated_at=? WHERE id=?',
          args: [ck, now, m.id],
        })
      }
    }
  }

  // 3. Build & upsert trips by cluster key.
  const tripGroups = new Map<string, FlightEmail[]>()
  for (const [bk, members] of bookings) {
    const ck = clusterOf.get(bk)!
    if (!tripGroups.has(ck)) tripGroups.set(ck, [])
    tripGroups.get(ck)!.push(...members)
  }

  for (const [key, members] of tripGroups) {
    const dates = members.map(bestDate).filter(Boolean).sort() as string[]
    const start = dates[0] ?? null
    const end = dates[dates.length - 1] ?? null
    const airlines = Array.from(new Set(members.map((m) => m.airline))).join(', ')
    const routes = Array.from(new Set(members.map((m) => m.route).filter(Boolean)))
    const label = `${airlines}${routes.length ? ` · ${routes.join(', ')}` : ''}${start ? ` · ${start.slice(0, 7)}` : ''}`

    const existing = await turso.execute({ sql: 'SELECT id FROM flight_trips WHERE trip_key = ?', args: [key] })
    if (existing.rows[0]) {
      await turso.execute({
        sql: 'UPDATE flight_trips SET label=?, start_date=?, end_date=?, airlines=?, updated_at=? WHERE trip_key=?',
        args: [label, start, end, airlines, now, key],
      })
    } else {
      await turso.execute({
        sql: `INSERT INTO flight_trips (id, trip_key, label, start_date, end_date, airlines, category, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'uncategorized', ?, ?)`,
        args: [id('trip'), key, label, start, end, airlines, now, now],
      })
    }
  }

  const keys = Array.from(tripGroups.keys())
  if (keys.length) {
    const placeholders = keys.map(() => '?').join(',')
    await turso.execute({ sql: `DELETE FROM flight_trips WHERE trip_key NOT IN (${placeholders})`, args: keys })
  } else {
    await turso.execute('DELETE FROM flight_trips')
  }
  return tripGroups.size
}

export interface TripWithEmails extends FlightTrip {
  emails: FlightEmail[]
  total_amount: number | null
  booking_count: number // distinct confirmation codes (bookings) in the trip
  matched_reports: string[] // expense report_numbers covering this trip's air travel
  has_expense: boolean
}

// Fare for a trip = sum over distinct bookings (confirmation codes) of that
// booking's fare (max amount across its emails) — so reminder emails that repeat
// the fare don't inflate the total. Codeless emails count individually.
function dedupedFare(emails: FlightEmail[]): { total: number | null; bookings: number } {
  const byBooking = new Map<string, number>()
  for (const e of emails) {
    const k = e.confirmation_code ? `code:${e.confirmation_code}` : e.id
    byBooking.set(k, Math.max(byBooking.get(k) ?? 0, e.amount ?? 0))
  }
  const total = [...byBooking.values()].reduce((s, v) => s + v, 0)
  return { total: total || null, bookings: byBooking.size }
}

export async function listTripsWithEmails(category?: TripCategory): Promise<TripWithEmails[]> {
  await runMigrations()
  const tripsSql = category
    ? 'SELECT * FROM flight_trips WHERE category = ? ORDER BY start_date DESC'
    : 'SELECT * FROM flight_trips ORDER BY start_date DESC'
  const trips = (
    await turso.execute(category ? { sql: tripsSql, args: [category] } : tripsSql)
  ).rows.map((r) => parseTrip(r as Record<string, unknown>))

  const result: TripWithEmails[] = []
  for (const t of trips) {
    const emails = (
      await turso.execute({
        sql: `SELECT fe.*, a.email_address AS account_email
              FROM flight_emails fe
              LEFT JOIN connected_email_accounts a ON fe.email_account_id = a.id
              WHERE fe.trip_key = ? ORDER BY fe.gmail_date ASC`,
        args: [t.trip_key],
      })
    ).rows.map((r) => {
      const row = r as Record<string, unknown>
      return { ...parseEmail(row), account_email: (row.account_email as string) ?? undefined }
    })
    const { total, bookings } = dedupedFare(emails)
    // The air-travel charge hits ~ at booking, so anchor the match window on the
    // booking-email dates, and require the expense merchant to be the SAME airline.
    const bookingDates = emails
      .map((e) => (e.gmail_date ? e.gmail_date.slice(0, 10) : null))
      .filter((d): d is string => !!d)
      .sort()
    const tokens = airlineMerchantTokens(t.airlines)
    const reports = bookingDates.length
      ? await matchedAirExpenseReports(
          shiftDate(bookingDates[0], -10),
          shiftDate(bookingDates[bookingDates.length - 1], 10),
          tokens
        )
      : []
    result.push({
      ...t,
      emails,
      total_amount: total,
      booking_count: bookings,
      matched_reports: reports,
      has_expense: reports.length > 0,
    })
  }
  return result
}

// Cross-reference: does a submitted air-travel expense for the SAME airline exist in
// the window? `tokens` are merchant substrings for the trip's airline(s); when known
// the expense merchant must match one (so a Southwest trip can't match United airfare).
// With no recognized airline, falls back to any air-travel charge in the window.
async function matchedAirExpenseReports(
  from: string,
  to: string,
  tokens: string[]
): Promise<string[]> {
  const args: (string | number)[] = [from, to]
  let merchantClause = ''
  if (tokens.length > 0) {
    merchantClause = ` AND (${tokens.map(() => 'LOWER(merchant) LIKE ?').join(' OR ')})`
    for (const t of tokens) args.push(`%${t.toLowerCase()}%`)
  }
  const res = await turso.execute({
    sql: `SELECT DISTINCT report_number FROM expense_transactions
          WHERE category LIKE '%Air Travel%'
            AND expense_date >= ? AND expense_date <= ?
            AND report_number != ''${merchantClause}`,
    args,
  })
  return res.rows.map((r) => String((r as Record<string, unknown>).report_number)).filter(Boolean)
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function getTripById(id: string): Promise<FlightTrip | null> {
  await runMigrations()
  const r = await turso.execute({ sql: 'SELECT * FROM flight_trips WHERE id = ?', args: [id] })
  if (!r.rows[0]) return null
  return parseTrip(r.rows[0] as Record<string, unknown>)
}

export async function setTripCategory(id: string, category: TripCategory): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE flight_trips SET category = ?, updated_at = ? WHERE id = ?',
    args: [category, new Date().toISOString(), id],
  })
}
