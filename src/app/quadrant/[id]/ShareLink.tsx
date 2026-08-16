'use client'

import { useState } from 'react'

/** Read-only URL + copy button. Builds the absolute URL on the client. */
export function ShareLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked — the input is selectable as a fallback.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 px-3 py-1.5 border border-line rounded-md text-xs text-ink-soft bg-surface font-mono"
      />
      <button
        onClick={copy}
        className="shrink-0 px-3 py-1.5 bg-ink text-white text-xs font-semibold rounded-md hover:opacity-90 transition-opacity"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  )
}
