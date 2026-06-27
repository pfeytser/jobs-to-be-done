'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { Bee } from '@/components/ui'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    AccessDenied: 'Your email is not authorized to access this app.',
    Configuration: 'There is a problem with the server configuration.',
    Verification: 'The verification link may have expired.',
    Default: 'An unexpected error occurred.',
  }

  const message = error ? (errorMessages[error] ?? errorMessages.Default) : errorMessages.Default

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-line shadow-md p-8 w-full max-w-prose text-center">
        <Bee size={44} className="mx-auto mb-4 text-ink" />
        <h1 className="font-display leading-tight text-3xl font-light tracking-tight text-ink mb-2">Oops!</h1>
        <p className="text-ink-soft mb-6">{message}</p>
        <Link
          href="/auth/signin"
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-800 text-on-inverse rounded-md font-semibold hover:bg-teal-900 transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}

export default function ErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
