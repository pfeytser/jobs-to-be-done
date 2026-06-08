import { turso } from './client'
import { runMigrations } from './migrations'

export interface ConnectedEmailAccount {
  id: string
  account_label: string
  email_address: string
  provider: string
  oauth_token_reference: string | null
  token_scope: string
  is_active: boolean
  last_authorized_at: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

// Public-safe shape — never exposes the encrypted token to the client.
export type SafeEmailAccount = Omit<ConnectedEmailAccount, 'oauth_token_reference'> & {
  has_token: boolean
}

function parse(row: Record<string, unknown>): ConnectedEmailAccount {
  return {
    id: row.id as string,
    account_label: (row.account_label as string) ?? '',
    email_address: (row.email_address as string) ?? '',
    provider: (row.provider as string) ?? 'gmail',
    oauth_token_reference: (row.oauth_token_reference as string) ?? null,
    token_scope: (row.token_scope as string) ?? '',
    is_active: Boolean(row.is_active),
    last_authorized_at: (row.last_authorized_at as string) ?? null,
    last_synced_at: (row.last_synced_at as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export function toSafe(a: ConnectedEmailAccount): SafeEmailAccount {
  const { oauth_token_reference, ...rest } = a
  return { ...rest, has_token: !!oauth_token_reference }
}

function newId(): string {
  return `acct_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function listEmailAccounts(activeOnly = false): Promise<ConnectedEmailAccount[]> {
  await runMigrations()
  const sql = activeOnly
    ? 'SELECT * FROM connected_email_accounts WHERE is_active = 1 ORDER BY account_label ASC'
    : 'SELECT * FROM connected_email_accounts ORDER BY account_label ASC'
  const result = await turso.execute(sql)
  return result.rows.map((r) => parse(r as Record<string, unknown>))
}

export async function getEmailAccountById(id: string): Promise<ConnectedEmailAccount | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM connected_email_accounts WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parse(result.rows[0] as Record<string, unknown>)
}

export async function getEmailAccountByEmail(
  email: string
): Promise<ConnectedEmailAccount | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM connected_email_accounts WHERE email_address = ? LIMIT 1',
    args: [email],
  })
  if (!result.rows[0]) return null
  return parse(result.rows[0] as Record<string, unknown>)
}

// Upserts an account by email address — reconnecting the same mailbox refreshes its
// encrypted token instead of creating a duplicate.
export async function upsertEmailAccount(data: {
  account_label: string
  email_address: string
  oauth_token_reference: string
  token_scope: string
}): Promise<ConnectedEmailAccount> {
  await runMigrations()
  const now = new Date().toISOString()
  const existing = await getEmailAccountByEmail(data.email_address)
  if (existing) {
    await turso.execute({
      sql: `UPDATE connected_email_accounts
            SET account_label = ?, oauth_token_reference = ?, token_scope = ?,
                is_active = 1, last_authorized_at = ?, updated_at = ?
            WHERE id = ?`,
      args: [data.account_label, data.oauth_token_reference, data.token_scope, now, now, existing.id],
    })
    return (await getEmailAccountById(existing.id))!
  }
  const id = newId()
  await turso.execute({
    sql: `INSERT INTO connected_email_accounts
          (id, account_label, email_address, provider, oauth_token_reference, token_scope,
           is_active, last_authorized_at, created_at, updated_at)
          VALUES (?, ?, ?, 'gmail', ?, ?, 1, ?, ?, ?)`,
    args: [id, data.account_label, data.email_address, data.oauth_token_reference, data.token_scope, now, now, now],
  })
  return (await getEmailAccountById(id))!
}

export async function setEmailAccountActive(id: string, active: boolean): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE connected_email_accounts SET is_active = ?, updated_at = ? WHERE id = ?',
    args: [active ? 1 : 0, new Date().toISOString(), id],
  })
}

export async function markAccountSynced(id: string): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: 'UPDATE connected_email_accounts SET last_synced_at = ?, updated_at = ? WHERE id = ?',
    args: [now, now, id],
  })
}

// Clears a stored token when a refresh fails so the UI can prompt a reconnect.
export async function clearEmailAccountToken(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE connected_email_accounts SET oauth_token_reference = NULL, updated_at = ? WHERE id = ?',
    args: [new Date().toISOString(), id],
  })
}

export async function deleteEmailAccount(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'DELETE FROM connected_email_accounts WHERE id = ?',
    args: [id],
  })
}
