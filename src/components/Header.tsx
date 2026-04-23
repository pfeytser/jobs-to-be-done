'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { AdminNav } from './AdminNav'

const SECTIONS: Array<{ prefix: string; label: string; href: string }> = [
  { prefix: '/jtbd', label: 'JTBD', href: '/jtbd' },
  { prefix: '/qa', label: 'QA', href: '/qa' },
  { prefix: '/storyboard', label: 'Storyboard', href: '/storyboard' },
  { prefix: '/on-site', label: 'On-site', href: '/on-site' },
  { prefix: '/admin', label: 'Admin', href: '/admin' },
]

export function Header() {
  const pathname = usePathname()
  const { data: session } = useSession()

  if (pathname.startsWith('/auth')) return null
  if (!session?.user) return null

  const section = SECTIONS.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(prefix + '/')
  )

  return (
    <header className="bg-surface border-b border-warm-border sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center hover:opacity-75 transition-opacity">
            <span className="text-xl">🐝</span>
          </Link>
          {section && (
            <>
              <span className="text-ink-3 text-sm select-none">/</span>
              <Link
                href={section.href}
                className="font-semibold text-ink text-sm hover:opacity-75 transition-opacity"
              >
                {section.label}
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AdminNav role={session.user.role} />
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? 'User'}
              className="w-7 h-7 rounded-full object-cover"
            />
          )}
          <span className="text-sm text-ink-2 hidden sm:block">
            {session.user.name ?? session.user.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="text-xs text-ink-3 hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
