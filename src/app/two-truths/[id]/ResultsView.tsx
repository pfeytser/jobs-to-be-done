'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ResultStatement {
  id: string
  text: string
  is_lie: boolean
  votes: number
  voters: string[]
}

const CONFETTI = ['#FBD349', '#6EE7B7', '#FCA5A5', '#DECEAC', '#112220']

export function ResultsView({
  title,
  authorName,
  statements,
  totalVotes,
  viewerVoted,
  viewerGuessId,
  isAuthor,
}: {
  title: string
  authorName: string
  statements: ResultStatement[]
  totalVotes: number
  viewerVoted: boolean
  viewerGuessId: string | null
  isAuthor: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 60)
    return () => clearTimeout(t)
  }, [])

  const lie = statements.find((s) => s.is_lie)
  const guessedCorrectly = viewerVoted && viewerGuessId === lie?.id

  return (
    <main className="min-h-screen bg-canvas relative overflow-hidden">
      {guessedCorrectly && revealed && (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className="tt-confetti"
              style={{
                left: `${(i * 97) % 100}%`,
                background: CONFETTI[i % CONFETTI.length],
                animationDelay: `${(i % 10) * 0.12}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 max-w-content mx-auto px-5 py-8 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-2">🏁 The reveal</p>
        <h1 className="font-display leading-tight text-3xl sm:text-4xl font-light text-ink tracking-tight">{title}</h1>
        <p className="text-ink-soft mt-1">by {authorName}</p>

        {viewerVoted && (
          <div
            className={`mt-5 p-5 rounded-lg border-2 text-center transition-all duration-500 ${
              guessedCorrectly
                ? 'border-pass-line bg-pass-soft'
                : 'border-fail-line bg-fail-soft'
            } ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          >
            <p className="text-2xl font-black text-ink">
              {guessedCorrectly ? 'You guessed correctly 🎉' : 'You guessed incorrectly 😅'}
            </p>
            <p className="text-sm text-ink-soft mt-1">
              {guessedCorrectly
                ? 'You spotted the lie. Nicely done.'
                : `The lie was hiding somewhere else.`}
            </p>
          </div>
        )}
        {!viewerVoted && !isAuthor && (
          <p className="mt-5 text-sm text-ink-muted">You didn&apos;t vote in this round — here&apos;s how it shook out.</p>
        )}
        {isAuthor && (
          <p className="mt-5 text-sm text-ink-muted">Here&apos;s how the team did against your lie 🤥</p>
        )}

        <div className="mt-6 space-y-3">
          {statements.map((s, i) => {
            const pct = totalVotes > 0 ? Math.round((s.votes / totalVotes) * 100) : 0
            const youGuessed = viewerGuessId === s.id
            return (
              <div
                key={s.id}
                className={`relative overflow-hidden rounded-lg border-2 p-5 transition-all duration-500 ${
                  s.is_lie
                    ? 'border-fail bg-fail-soft/50'
                    : 'border-line bg-surface'
                }`}
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                {/* vote-share bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-accent/25 transition-all duration-700 ease-out"
                  style={{ width: revealed ? `${pct}%` : '0%' }}
                  aria-hidden
                />
                <div className="relative">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm font-black bg-canvas text-ink border border-line">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-lg text-ink font-medium leading-snug flex-1">{s.text}</span>
                  </div>
                  <div className="flex items-center flex-wrap gap-2 mt-3 pl-10">
                    {s.is_lie && (
                      <span className="text-xs font-black text-white bg-fail px-2.5 py-1 rounded-full">
                        🤥 THE LIE
                      </span>
                    )}
                    {youGuessed && (
                      <span className="text-xs font-bold text-ink bg-accent px-2.5 py-1 rounded-md">
                        Your guess
                      </span>
                    )}
                    <span className="text-sm font-bold text-ink-soft">
                      {s.votes} {s.votes === 1 ? 'vote' : 'votes'} · {pct}%
                    </span>
                  </div>
                  {s.voters.length > 0 && (
                    <p className="text-sm text-ink-muted mt-2 pl-10">{s.voters.join(', ')}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm text-ink-muted mt-6">
          {totalVotes} {totalVotes === 1 ? 'person' : 'people'} voted
        </p>

        <div className="mt-6 text-center">
          <Link
            href="/two-truths"
            className="inline-block px-6 py-3 bg-ink text-white font-bold rounded-md hover:opacity-90 transition-opacity"
          >
            ← Back to games
          </Link>
        </div>
      </div>
    </main>
  )
}
