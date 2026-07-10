'use client'

import { useState } from 'react'

export function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/prototypes/${slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 text-xs font-medium bg-canvas border border-line text-ink rounded-xs hover:border-ink transition-colors whitespace-nowrap"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}
