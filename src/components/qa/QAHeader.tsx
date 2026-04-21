'use client'

import Link from 'next/link'
import { AdminNav } from '@/components/AdminNav'

interface QAHeaderProps {
  role: 'admin' | 'collaborator'
  userName?: string | null
  userImage?: string | null
  onSignOut?: () => void
}

export function QAHeader({ role, userName, userImage, onSignOut }: QAHeaderProps) {
  return (
    <header className="bg-surface border-b border-warm-border sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qa" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
            <span className="text-xl">🧪</span>
            <span className="font-semibold text-ink">QA Testing</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <AdminNav role={role} />
          {userImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userImage} alt={userName ?? 'User'} className="w-7 h-7 rounded-full object-cover" />
          )}
          <span className="text-sm text-ink-2 hidden sm:block">{userName}</span>
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="text-xs text-ink-3 hover:text-ink transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
