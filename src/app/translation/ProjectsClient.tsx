'use client'

import Link from 'next/link'
import type { TranslationProject } from '@/lib/translation/types'

// Clean project picker. Translators land here, pick their project, and start working.
// All project/source management lives in /translation/admin (owner only).
export function ProjectsClient({
  initialProjects,
  isOwner,
}: {
  initialProjects: TranslationProject[]
  isOwner: boolean
}) {
  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <div>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink transition-colors">
            ← Home
          </Link>
          <h1 className="font-display tracking-tight text-2xl font-bold text-ink mt-2">Translation Review</h1>
          <p className="text-sm text-ink-muted mt-1">Pick a project to review and refine its translations.</p>
        </div>
        {isOwner && (
          <Link
            href="/translation/admin"
            className="shrink-0 px-4 py-2 text-sm font-medium border border-line rounded-md bg-surface hover:border-ink transition-colors"
          >
            ⚙ Setup &amp; projects
          </Link>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {initialProjects.length === 0 && (
          <p className="text-sm text-ink-muted">
            No projects yet.{' '}
            {isOwner && (
              <Link href="/translation/admin" className="text-ink underline">
                Create one in Setup.
              </Link>
            )}
          </p>
        )}
        {initialProjects.map((proj) => (
          <Link
            key={proj.id}
            href={`/translation/${proj.id}`}
            className="flex items-center justify-between bg-surface border border-line rounded-lg p-5 hover:border-ink transition-colors group"
          >
            <div>
              <p className="text-base font-semibold text-ink">{proj.name}</p>
              <p className="text-sm text-ink-muted mt-0.5">Open editor →</p>
            </div>
            <svg className="w-5 h-5 text-ink-muted group-hover:text-ink transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
