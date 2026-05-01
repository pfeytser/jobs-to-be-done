'use client'

import { useState, useRef, useCallback } from 'react'
import { marked } from 'marked'

type Phase = 'idle' | 'fetching' | 'reviewing' | 'done' | 'error'

export function CodeReviewClient() {
  const [urls, setUrls] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [progressMessages, setProgressMessages] = useState<string[]>([])
  const [reviewHtml, setReviewHtml] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const reviewAccumRef = useRef('')
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushReview = useCallback(() => {
    const html = marked.parse(reviewAccumRef.current) as string
    setReviewHtml(html)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!urls.trim()) return

    setPhase('fetching')
    setProgressMessages([])
    setReviewHtml('')
    setErrorMsg('')
    reviewAccumRef.current = ''

    try {
      const res = await fetch('/api/code-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let inReview = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })

        // process line by line for sentinels, but pass review text through immediately
        if (!inReview) {
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (line.startsWith('__PROGRESS__:')) {
              setProgressMessages((prev) => [...prev, line.slice('__PROGRESS__:'.length)])
            } else if (line === '__REVIEW_START__') {
              inReview = true
              setPhase('reviewing')
            } else if (line.startsWith('__ERROR__:')) {
              throw new Error(line.slice('__ERROR__:'.length))
            }
          }
        } else {
          // check for error sentinel at end
          if (buf.includes('__ERROR__:')) {
            const idx = buf.indexOf('__ERROR__:')
            reviewAccumRef.current += buf.slice(0, idx)
            throw new Error(buf.slice(idx + '__ERROR__:'.length))
          }
          reviewAccumRef.current += buf
          buf = ''

          // throttled render
          if (!renderTimerRef.current) {
            renderTimerRef.current = setTimeout(() => {
              renderTimerRef.current = null
              flushReview()
            }, 80)
          }
        }
      }

      // final flush
      if (renderTimerRef.current) {
        clearTimeout(renderTimerRef.current)
        renderTimerRef.current = null
      }
      flushReview()
      setPhase('done')
    } catch (err) {
      setErrorMsg((err as Error).message)
      setPhase('error')
    }
  }, [urls, flushReview])

  return (
    <div className="min-h-screen bg-canvas">
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink mb-1">Code Review</h1>
          <p className="text-sm text-ink-3">
            Paste one or more GitHub PR URLs (one per line) for an L7-level AI review.
          </p>
        </div>

        <div className="bg-surface border border-warm-border rounded-xl p-6 mb-6">
          <label className="block text-sm font-semibold text-ink mb-2">
            GitHub PR URLs
          </label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://github.com/owner/repo/pull/123&#10;https://github.com/owner/repo/pull/456"
            rows={4}
            disabled={phase === 'fetching' || phase === 'reviewing'}
            className="w-full text-sm font-mono bg-canvas border border-warm-border rounded-lg px-3 py-2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink/20 resize-none disabled:opacity-50"
          />
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!urls.trim() || phase === 'fetching' || phase === 'reviewing'}
              className="px-5 py-2 bg-ink text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {phase === 'fetching' ? 'Fetching PRs…' : phase === 'reviewing' ? 'Reviewing…' : 'Review'}
            </button>
            {(phase === 'done' || phase === 'error') && (
              <button
                onClick={() => {
                  setPhase('idle')
                  setProgressMessages([])
                  setReviewHtml('')
                  setErrorMsg('')
                  reviewAccumRef.current = ''
                }}
                className="px-5 py-2 text-sm font-semibold text-ink-2 border border-warm-border rounded-full hover:bg-canvas transition-colors"
              >
                New review
              </button>
            )}
          </div>
        </div>

        {progressMessages.length > 0 && phase !== 'done' && (
          <div className="bg-mist border border-warm-border rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2">Progress</p>
            <ul className="space-y-1">
              {progressMessages.map((msg, i) => (
                <li key={i} className="text-sm text-ink-2 flex items-start gap-2">
                  <span className="text-ink-3 mt-0.5 shrink-0">›</span>
                  {msg}
                </li>
              ))}
              {(phase === 'fetching' || phase === 'reviewing') && (
                <li className="text-sm text-ink-3 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-ink-3 border-t-transparent rounded-full animate-spin" />
                  {phase === 'reviewing' ? 'Streaming review…' : 'Working…'}
                </li>
              )}
            </ul>
          </div>
        )}

        {phase === 'error' && (
          <div className="bg-status-fail border border-status-fail-text/20 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-status-fail-text">Error</p>
            <p className="text-sm text-status-fail-text/80 mt-1">{errorMsg}</p>
          </div>
        )}

        {(reviewHtml || phase === 'reviewing') && (
          <div className="bg-surface border border-warm-border rounded-xl p-6">
            {reviewHtml ? (
              <div
                className="prose prose-sm max-w-none text-ink"
                dangerouslySetInnerHTML={{ __html: reviewHtml }}
              />
            ) : (
              <p className="text-sm text-ink-3">Receiving review…</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
