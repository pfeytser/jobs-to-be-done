import { turso } from './client'
import { runMigrations } from './migrations'
import { airlineMerchantTokens } from '@/lib/expenses/flights'

export type TripCategory = 'uncategorized' | 'business' | 'personal'

export interface FlightEmail {
  id: string
  email_account_id: string
  gmail_message_id: string
  gmail_thread_id: string | null
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
            amount=?, currency=?, gmail_subject=?, gmail_from=?, gmail_date=?, trip_key=?, updated_at=?
            WHERE id=?`,
      args: [
        data.airline, data.confirmation_code, data.travel_date, data.route, data.amount,
        data.currency, data.gmail_subject, data.gmail_from, data.gmail_date, data.trip_key, now,
        (existing.rows[0] as Record<string, unknown>).id as string,
      ],
    })
    return false
  }
  await turso.execute({
    sql: `INSERT INTO flight_emails (id, email_account_id, gmail_message_id, gmail_thread_id,
          airline, confirmation_code, travel_date, route, amount, currency, gmail_subject,
          gmail_from, gmail_date, trip_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id('fe'), data.email_account_id, data.gmail_message_id, data.gmail_thread_id, data.airline,
      data.confirmation_code, data.travel_date, data.route, data.amount, data.currency,
      data.gmail_subject, data.gmail_from, data.gmail_date, data.trip_key, now, now,
    ],
  })
  return true
}

// Rebuilds the flight_trips table from current flight_emails, grouped by trip_key.
// Preserves each trip's category across rebuilds; removes trips with no emails.
export async function rebuildTrips(): Promise<number> {
  await runMigrations()
  const now = new Date().toISOString()
  const emails = (await turso.execute('SELECT * FROM flight_emails')).rows.map((r) =>
    parseEmail(r as Record<string, unknown>)
  )

  const groups = new Map<string, FlightEmail[]>()
  for (const e of emails) {
    if (!groups.has(e.trip_key)) groups.set(e.trip_key, [])
    groups.get(e.trip_key)!.push(e)
  }

  for (const [key, members] of groups) {
    const dates = members
      .map((m) => m.travel_date || (m.gmail_date ? m.gmail_date.slice(0, 10) : null))
      .filter(Boolean)
      .sort() as string[]
    const start = dates[0] ?? null
    const end = dates[dates.length - 1] ?? null
    const airlines = Array.from(new Set(members.map((m) => m.airline))).join(', ')
    const route = members.find((m) => m.route)?.route
    const label = `${airlines}${route ? ` · ${route}` : ''}${start ? ` · ${start.slice(0, 7)}` : ''}`

    const existing = await turso.execute({
      sql: 'SELECT id FROM flight_trips WHERE trip_key = ?',
      args: [key],
    })
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

  // Remove orphan trips (no emails any more)
  const keys = Array.from(groups.keys())
  if (keys.length) {
    const placeholders = keys.map(() => '?').join(',')
    await turso.execute({
      sql: `DELETE FROM flight_trips WHERE trip_key NOT IN (${placeholders})`,
      args: keys,
    })
  } else {
    await turso.execute('DELETE FROM flight_trips')
  }
  return groups.size
}

export interface TripWithEmails extends FlightTrip {
  emails: FlightEmail[]
  total_amount: number | null
  matched_reports: string[] // expense report_numbers covering this trip's air travel
  has_expense: boolean
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
    const total = emails.reduce((s, e) => s + (e.amount ?? 0), 0)
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
      total_amount: total || null,
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
