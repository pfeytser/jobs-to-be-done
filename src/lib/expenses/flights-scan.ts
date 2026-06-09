import { listEmailAccounts, markAccountSynced, clearEmailAccountToken } from '@/lib/db/email-accounts'
import { upsertFlightEmail, rebuildTrips } from '@/lib/db/flights'
import { decryptToken } from './crypto'
import { clientFromRefreshToken } from './google-oauth'
import { searchMessages, getMessage, buildGmailQuery } from './gmail'
import { allAirlineDomains, extractFlight, tripKeyFor } from './flights'

export interface FlightScanConfig {
  afterIso: string // inclusive, yyyy-mm-dd
  beforeIso: string // exclusive
  messagesPerQuery: number
  log: (msg: string) => void
}

export interface FlightScanSummary {
  accounts: { label: string; email: string; ok: boolean; note?: string }[]
  messagesScanned: number
  flightEmailsFound: number
  newEmails: number
  trips: number
  errors: string[]
}

// Subject-keyword query to catch airline/OTA confirmations from domains we don't list.
const KEYWORD_QUERY =
  '(subject:itinerary OR subject:"e-ticket" OR subject:"booking confirmation" OR ' +
  'subject:"flight confirmation" OR subject:"trip confirmation" OR subject:"boarding pass" OR ' +
  '"your flight" OR "record locator")'

export async function scanFlights(cfg: FlightScanConfig): Promise<FlightScanSummary> {
  const summary: FlightScanSummary = {
    accounts: [],
    messagesScanned: 0,
    flightEmailsFound: 0,
    newEmails: 0,
    trips: 0,
    errors: [],
  }

  const accounts = await listEmailAccounts(true)
  const domainQuery = buildGmailQuery({
    tokens: [],
    fromDomains: allAirlineDomains(),
    afterIso: cfg.afterIso,
    beforeIso: cfg.beforeIso,
  })
  const dateClause = `after:${cfg.afterIso.replace(/-/g, '/')} before:${cfg.beforeIso.replace(/-/g, '/')}`
  const keywordQuery = `${KEYWORD_QUERY} ${dateClause} -in:chats`

  for (const account of accounts) {
    if (!account.oauth_token_reference) {
      summary.accounts.push({ label: account.account_label, email: account.email_address, ok: false, note: 'no token — reconnect' })
      continue
    }
    let client
    try {
      client = await clientFromRefreshToken(decryptToken(account.oauth_token_reference))
      summary.accounts.push({ label: account.account_label, email: account.email_address, ok: true })
    } catch {
      await clearEmailAccountToken(account.id)
      summary.accounts.push({ label: account.account_label, email: account.email_address, ok: false, note: 'token refresh failed — reconnect' })
      continue
    }

    const seen = new Set<string>()
    for (const query of [domainQuery, keywordQuery]) {
      let found: { id: string; threadId: string }[] = []
      try {
        found = await searchMessages(client, query, cfg.messagesPerQuery)
      } catch (e) {
        summary.errors.push(`search ${account.email_address}: ${e instanceof Error ? e.message : e}`)
        continue
      }
      for (const m of found) {
        if (seen.has(m.id)) continue
        seen.add(m.id)
        summary.messagesScanned++
        try {
          const parsed = await getMessage(client, m.id)
          const ex = extractFlight(parsed)
          if (!ex.isFlight) continue
          summary.flightEmailsFound++
          const isNew = await upsertFlightEmail({
            email_account_id: account.id,
            gmail_message_id: parsed.messageId,
            gmail_thread_id: parsed.threadId,
            airline: ex.airline,
            confirmation_code: ex.confirmationCode,
            travel_date: ex.travelDate,
            route: ex.route,
            amount: ex.amount,
            currency: null,
            gmail_subject: parsed.subject,
            gmail_from: parsed.from,
            gmail_date: parsed.dateIso,
            trip_key: tripKeyFor(ex, account.id, parsed.messageId),
          })
          if (isNew) summary.newEmails++
          cfg.log(`  [${account.account_label}] ${ex.airline}${ex.route ? ' ' + ex.route : ''}${ex.confirmationCode ? ' ' + ex.confirmationCode : ''} :: ${parsed.subject.slice(0, 60)}`)
        } catch (e) {
          summary.errors.push(`get ${m.id}: ${e instanceof Error ? e.message : e}`)
        }
      }
    }
    await markAccountSynced(account.id)
  }

  summary.trips = await rebuildTrips()
  return summary
}
