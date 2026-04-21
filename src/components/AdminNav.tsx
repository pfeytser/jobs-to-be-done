'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ADMIN_LINKS = [
  { href: '/admin/jtbd', label: 'JTBD Exercise', emoji: '🐝' },
  { href: '/qa/admin', label: 'QA Project', emoji: '🧪' },
  { href: '/admin/storyboard', label: 'Storyboard', emoji: '🎬' },
]

const BROWSE_LINKS = [
  { href: '/jtbd', label: 'JTBD' },
  { href: '/qa', label: 'QA' },
  { href: '/on-site', label: 'On-site' },
]

export function AdminNav({ role }: { role: 'admin' | 'collaborator' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (role !== 'admin') return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-sand border border-warm-border text-ink text-xs font-semibold rounded-full hover:bg-ink hover:text-white hover:border-ink transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Admin
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-warm-border rounded-[14px] shadow-lg overflow-hidden z-50">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Manage</p>
            {ADMIN_LINKS.map(({ href, label, emoji }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-canvas transition-colors text-sm text-ink"
              >
                <span className="text-base">{emoji}</span>
                {label}
              </Link>
            ))}
          </div>

          <div className="border-t border-warm-border px-3 pt-2 pb-3 mt-1">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Browse</p>
            <div className="flex flex-wrap gap-1.5">
              {BROWSE_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="px-2.5 py-1 text-xs text-ink border border-warm-border rounded-full hover:border-ink hover:bg-canvas transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
