'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SafeEmailAccount } from '@/lib/db/email-accounts'
import { ConfirmDialog } from '@/components/ui'

const CONNECT_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  success: { ok: true, text: 'Account connected.' },
  'error:no_refresh_token': {
    ok: false,
    text: 'Google did not return a refresh token. Remove the app from your Google account permissions and reconnect.',
  },
  'error:state_mismatch': { ok: false, text: 'Security check failed (state mismatch). Try again.' },
  'error:exchange_failed': { ok: false, text: 'Token exchange failed. Check the OAuth client config.' },
  'error:no_email': { ok: false, text: 'Could not read the mailbox address.' },
}

export function AccountsClient({
  initialAccounts,
  configured,
}: {
  initialAccounts: SafeEmailAccount[]
  configured: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [accounts, setAccounts] = useState(initialAccounts)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingDisconnect, setPendingDisconnect] = useState<string | null>(null)
  const connectStatus = sp.get('connect')

  useEffect(() => {
    setAccounts(initialAccounts)
  }, [initialAccounts])

  const banner = connectStatus
    ? CONNECT_MESSAGES[connectStatus] ?? { ok: false, text: `Connection error: ${connectStatus}` }
    : null

  async function toggle(id: string, isActive: boolean) {
    setBusy(id)
    try {
      await fetch(`/api/expenses/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function disconnect(id: string) {
    setBusy(id)
    try {
      await fetch(`/api/expenses/accounts/${id}`, { method: 'DELETE' })
      router.refresh()
      setPendingDisconnect(null)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      {banner && (
        <div
          className={`p-3 mb-4 rounded-sm text-sm border ${
            banner.ok
              ? 'bg-pass-soft border-pass-line text-pass'
              : 'bg-fail-soft border-fail-line text-fail'
          }`}
        >
          {banner.text}
        </div>
      )}

      {!configured && (
        <div className="p-3 mb-4 rounded-sm text-sm bg-blocked-soft border border-blocked-line text-blocked">
          Gmail connect isn’t configured yet. Set <code>GOOGLE_RECEIPT_CLIENT_ID</code>,{' '}
          <code>GOOGLE_RECEIPT_CLIENT_SECRET</code>, and <code>GOOGLE_RECEIPT_REDIRECT_URI</code> in
          your environment, then reload.
        </div>
      )}

      <div className="space-y-2 mb-5">
        {accounts.length === 0 ? (
          <div className="bg-surface border border-line rounded-md p-6 text-center text-sm text-ink-muted">
            No accounts connected yet.
          </div>
        ) : (
          accounts.map((a) => (
            <div
              key={a.id}
              className="bg-surface border border-line rounded-md p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{a.account_label}</span>
                  {a.is_active ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pass-soft text-pass">active</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-skipped-soft text-ink-muted">paused</span>
                  )}
                  {!a.has_token && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-fail-soft text-fail">reconnect needed</span>
                  )}
                </div>
                <p className="text-sm text-ink-soft truncate">{a.email_address}</p>
                <p className="text-xs text-ink-muted">
                  {a.last_synced_at
                    ? `Last searched ${new Date(a.last_synced_at).toLocaleString()}`
                    : 'Never searched'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggle(a.id, a.is_active)}
                  disabled={busy === a.id}
                  className="px-3 py-1.5 text-xs font-medium bg-canvas border border-line text-ink rounded-xs hover:border-ink disabled:opacity-40 transition-colors"
                >
                  {a.is_active ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={() => setPendingDisconnect(a.id)}
                  disabled={busy === a.id}
                  className="px-3 py-1.5 text-xs font-medium text-fail hover:underline disabled:opacity-40"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <a
          href="/api/expenses/accounts/connect?label=work"
          className={`px-4 py-2 text-sm font-semibold rounded-sm transition-opacity ${
            configured ? 'bg-ink text-white hover:opacity-90' : 'bg-ink/40 text-white pointer-events-none'
          }`}
        >
          Connect work Gmail
        </a>
        <a
          href="/api/expenses/accounts/connect?label=personal"
          className={`px-4 py-2 text-sm font-semibold rounded-sm border transition-colors ${
            configured
              ? 'bg-surface border-line text-ink hover:border-ink'
              : 'bg-surface border-line text-ink-muted pointer-events-none'
          }`}
        >
          Connect personal Gmail
        </a>
      </div>

      <ConfirmDialog
        open={!!pendingDisconnect}
        onCancel={() => setPendingDisconnect(null)}
        onConfirm={() => pendingDisconnect && disconnect(pendingDisconnect)}
        title="Disconnect this account?"
        danger
        confirmLabel="Disconnect"
        loading={!!pendingDisconnect && busy === pendingDisconnect}
      >
        Its stored token will be revoked. You can reconnect it later.
      </ConfirmDialog>
    </div>
  )
}
