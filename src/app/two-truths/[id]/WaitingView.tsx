interface DisplayStatement {
  id: string
  text: string
}

/**
 * Static post-vote / author-live screen. No vote counts are shown until the
 * host triggers the reveal — the StatusPoller (rendered by the page) flips this
 * view to results automatically when that happens.
 */
export function WaitingView({
  title,
  authorName,
  isAuthor,
  guessedStatementId,
  statements,
}: {
  title: string
  authorName: string
  isAuthor: boolean
  guessedStatementId?: string | null
  statements: DisplayStatement[]
}) {
  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-3 mb-2">⏳ Hang tight</p>
        <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">{title}</h1>

        <div className="mt-6 p-6 rounded-2xl bg-surface border border-warm-border text-center">
          <div className="text-5xl mb-3 animate-pulse">🍿</div>
          {isAuthor ? (
            <>
              <p className="text-lg font-bold text-ink">Your game is live!</p>
              <p className="text-ink-2 mt-1">
                Players are guessing now. The host will reveal the answer when everyone&apos;s voted.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-ink">You&apos;re locked in 🔒</p>
              <p className="text-ink-2 mt-1">
                Waiting for the host to reveal whether you spotted {authorName}&apos;s lie…
              </p>
            </>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {statements.map((s, i) => {
            const guessed = s.id === guessedStatementId
            return (
              <div
                key={s.id}
                className={`p-5 rounded-2xl border-2 ${
                  guessed ? 'border-ink bg-gold/20' : 'border-warm-border bg-surface/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm font-black bg-canvas text-ink-3 border border-warm-border">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-lg text-ink font-medium leading-snug">{s.text}</span>
                  {guessed && (
                    <span className="ml-auto shrink-0 text-xs font-bold text-ink bg-gold px-2 py-1 rounded-full">
                      Your guess
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
