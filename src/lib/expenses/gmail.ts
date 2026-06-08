import { google, type gmail_v1 } from 'googleapis'
import type { ReceiptAuthClient } from './google-oauth'
import type { ScorableEmail, EmailAttachmentMeta } from './scoring'

export interface GmailAttachment extends EmailAttachmentMeta {
  attachmentId: string
  size: number
}

export interface ParsedGmailMessage extends ScorableEmail {
  messageId: string
  threadId: string
  attachments: GmailAttachment[]
  links: string[]
}

function gmailClient(auth: ReceiptAuthClient): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth })
}

// Builds a Gmail search query: date window + an OR-group identifying the MERCHANT —
// its name tokens plus `from:` clauses for known sender domains. Transactional
// keywords are deliberately NOT in the query: OR-ing "receipt/invoice/order/…" matches
// almost every email and floods results with noise. Keywords (and amounts, which
// Gmail can't filter reliably) are applied during scoring after fetching the body.
export function buildGmailQuery(params: {
  tokens: string[]
  fromDomains?: string[]
  afterIso: string // inclusive
  beforeIso: string // exclusive (Gmail before: semantics)
}): string {
  const after = gmailDate(params.afterIso)
  const before = gmailDate(params.beforeIso)
  const terms = Array.from(new Set(params.tokens.filter(Boolean))).map((t) =>
    t.includes(' ') ? `"${t}"` : t
  )
  for (const d of params.fromDomains ?? []) terms.push(`from:${d}`)
  const orGroup = terms.length ? `(${terms.join(' OR ')})` : ''
  return `${orGroup} after:${after} before:${before} -in:chats`.trim()
}

function gmailDate(iso: string): string {
  // Gmail wants YYYY/MM/DD.
  const d = iso.slice(0, 10)
  return d.replace(/-/g, '/')
}

export async function searchMessages(
  auth: ReceiptAuthClient,
  query: string,
  maxResults = 15
): Promise<{ id: string; threadId: string }[]> {
  const gmail = gmailClient(auth)
  const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults })
  return (res.data.messages ?? []).map((m) => ({
    id: m.id!,
    threadId: m.threadId ?? '',
  }))
}

function header(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  const h = headers?.find((x) => (x.name ?? '').toLowerCase() === name.toLowerCase())
  return h?.value ?? ''
}

function decodeBody(data: string | null | undefined): string {
  if (!data) return ''
  return Buffer.from(data, 'base64').toString('utf-8')
}

// Walks the MIME tree collecting text/plain, text/html, and attachment metadata.
function walkParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  acc: { text: string; html: string; attachments: GmailAttachment[] }
): void {
  if (!part) return
  const mime = part.mimeType ?? ''
  if (mime === 'text/plain') {
    acc.text += decodeBody(part.body?.data) + '\n'
  } else if (mime === 'text/html') {
    acc.html += decodeBody(part.body?.data) + '\n'
  } else if (part.filename && part.body?.attachmentId) {
    acc.attachments.push({
      attachmentId: part.body.attachmentId,
      filename: part.filename,
      mimeType: mime,
      size: part.body.size ?? 0,
    })
  }
  for (const child of part.parts ?? []) walkParts(child, acc)
}

const LINK_RE = /https?:\/\/[^\s"'<>)]+/gi

export async function getMessage(
  auth: ReceiptAuthClient,
  messageId: string
): Promise<ParsedGmailMessage> {
  const gmail = gmailClient(auth)
  const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' })
  const msg = res.data
  const headers = msg.payload?.headers

  const acc = { text: '', html: '', attachments: [] as GmailAttachment[] }
  walkParts(msg.payload, acc)

  const dateHeader = header(headers, 'Date')
  const parsedDate = dateHeader ? new Date(dateHeader) : null
  const dateIso = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null

  const links = Array.from(new Set([...(acc.html.match(LINK_RE) ?? []), ...(acc.text.match(LINK_RE) ?? [])]))

  return {
    messageId: msg.id ?? messageId,
    threadId: msg.threadId ?? '',
    subject: header(headers, 'Subject'),
    from: header(headers, 'From'),
    to: header(headers, 'To'),
    dateIso,
    text: acc.text,
    html: acc.html,
    attachments: acc.attachments,
    links,
  }
}

export async function downloadAttachment(
  auth: ReceiptAuthClient,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const gmail = gmailClient(auth)
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  })
  const data = res.data.data ?? ''
  // Gmail returns URL-safe base64.
  return Buffer.from(data, 'base64')
}
