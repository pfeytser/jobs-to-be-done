import { google } from 'googleapis'

// Use the OAuth2 client type as produced by `googleapis` itself, to avoid the
// well-known dual google-auth-library version mismatch.
export type ReceiptAuthClient = InstanceType<typeof google.auth.OAuth2>

// Dedicated OAuth client for connecting Gmail mailboxes for receipt search. This is
// intentionally SEPARATE from the NextAuth login client so the login flow keeps its
// minimal scopes and connecting a mailbox never doubles as a login.
//
// Required env:
//   GOOGLE_RECEIPT_CLIENT_ID
//   GOOGLE_RECEIPT_CLIENT_SECRET
//   GOOGLE_RECEIPT_REDIRECT_URI  (e.g. http://localhost:3000/api/expenses/accounts/callback)

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

export function getReceiptOAuthClient(): ReceiptAuthClient {
  const clientId = process.env.GOOGLE_RECEIPT_CLIENT_ID
  const clientSecret = process.env.GOOGLE_RECEIPT_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_RECEIPT_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Gmail connect is not configured. Set GOOGLE_RECEIPT_CLIENT_ID, ' +
        'GOOGLE_RECEIPT_CLIENT_SECRET, and GOOGLE_RECEIPT_REDIRECT_URI.'
    )
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

// Builds the consent URL. `state` carries the requested account label through the
// round-trip. access_type=offline + prompt=consent guarantees a refresh token.
export function buildConsentUrl(state: string): string {
  const client = getReceiptOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_SCOPE],
    include_granted_scopes: false,
    state,
  })
}

export interface ExchangedTokens {
  refreshToken: string | null
  accessToken: string | null
  scope: string
  emailAddress: string
}

// Exchanges an auth code for tokens and resolves the mailbox address via
// gmail.users.getProfile (no extra scope needed beyond gmail.readonly).
export async function exchangeCodeForTokens(code: string): Promise<ExchangedTokens> {
  const client = getReceiptOAuthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  const gmail = google.gmail({ version: 'v1', auth: client })
  const profile = await gmail.users.getProfile({ userId: 'me' })

  return {
    refreshToken: tokens.refresh_token ?? null,
    accessToken: tokens.access_token ?? null,
    scope: tokens.scope ?? GMAIL_SCOPE,
    emailAddress: profile.data.emailAddress ?? '',
  }
}

// Returns an authorized OAuth client for a stored refresh token. Throws if the
// refresh fails (revoked / expired in testing mode) so callers can flag a reconnect.
export async function clientFromRefreshToken(refreshToken: string): Promise<ReceiptAuthClient> {
  const client = getReceiptOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  // Force a token refresh up front so failures surface here, not mid-search.
  await client.getAccessToken()
  return client
}

// Best-effort revocation when disconnecting an account.
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const client = getReceiptOAuthClient()
    await client.revokeToken(refreshToken)
  } catch {
    // Token may already be invalid — disconnect proceeds regardless.
  }
}
