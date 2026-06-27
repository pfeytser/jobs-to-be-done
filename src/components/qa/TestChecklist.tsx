'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { QATestItem } from '@/lib/db/qa-test-items'
import type { QAResult } from '@/lib/db/qa-results'
import type { QASession } from '@/lib/db/qa-sessions'
import { FailModal } from './FailModal'
import { BlockedModal } from './BlockedModal'
import { SessionMood } from './SessionMood'
import { CompleteSessionButton } from './CompleteSessionButton'

interface TestChecklistProps {
  qaSession: QASession
  items: QATestItem[]
  initialResults: QAResult[]
  previousUsernames: string[]
  setupInstructions?: string
  backHref: string
  backLabel: string
}

type ResultStatus = 'pass' | 'fail' | 'blocked' | 'skipped' | 'not_tested'

export function TestChecklist({
  qaSession,
  items,
  initialResults,
  previousUsernames,
  setupInstructions,
  backHref,
  backLabel,
}: TestChecklistProps) {
  const router = useRouter()
  const [passTrigger, setPassTrigger] = useState(0)
  const [failTrigger, setFailTrigger] = useState(0)

  // Map test_item_id → result
  const [results, setResults] = useState<Map<string, QAResult>>(() => {
    const map = new Map<string, QAResult>()
    for (const r of initialResults) map.set(r.test_item_id, r)
    return map
  })

  const [failModalItemId, setFailModalItemId] = useState<string | null>(null)
  const [blockedModalItemId, setBlockedModalItemId] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Stats
  const stats = useMemo(() => {
    let passed = 0, failed = 0, blocked = 0, skipped = 0
    for (const r of results.values()) {
      if (r.status === 'pass') passed++
      else if (r.status === 'fail') failed++
      else if (r.status === 'blocked') blocked++
      else if (r.status === 'skipped') skipped++
    }
    const done = passed + failed + blocked + skipped
    return { passed, failed, blocked, skipped, done, total: items.length }
  }, [results, items.length])

  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
  const isComplete = pct === 100 && stats.total > 0

  // Auto-complete session when all items are done
  const autoCompletedRef = useRef(false)
  useEffect(() => {
    if (isComplete && !autoCompletedRef.current) {
      autoCompletedRef.current = true
      fetch(`/api/qa/sessions/${qaSession.id}`, { method: 'PATCH' }).catch(() => {})
    }
  }, [isComplete, qaSession.id])

  // Group items by Part → Section
  const grouped = useMemo(() => {
    const parts = new Map<string, Map<string, QATestItem[]>>()
    for (const item of items) {
      const part = item.part || 'General'
      const section = item.section || ''
      if (!parts.has(part)) parts.set(part, new Map())
      const sections = parts.get(part)!
      if (!sections.has(section)) sections.set(section, [])
      sections.get(section)!.push(item)
    }
    return parts
  }, [items])

  async function handleQuickStatus(item: QATestItem, status: 'pass' | 'skipped') {
    setSavingKey(`${item.id}:${status}`)
    try {
      const res = await fetch(`/api/qa/sessions/${qaSession.id}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_item_id: item.id, status }),
      })
      if (res.ok) {
        const data = await res.json()
        setResults((prev) => new Map(prev).set(item.id, data.result))
        if (status === 'pass') setPassTrigger((n) => n + 1)
      }
    } finally {
      setSavingKey(null)
    }
  }

  function handleResultSaved(itemId: string) {
    // Re-fetch the session data to get fresh results
    fetch(`/api/qa/sessions/${qaSession.id}`)
      .then((r) => r.json())
      .then((data) => {
        const map = new Map<string, QAResult>()
        for (const r of (data.results ?? [])) map.set(r.test_item_id, r)
        setResults(map)
      })
      .catch(() => {})
  }

  function getStatusStyle(status: ResultStatus | undefined) {
    switch (status) {
      case 'pass': return 'bg-pass-soft border-pass-line'
      case 'fail': return 'bg-fail-soft border-fail-line'
      case 'blocked': return 'bg-blocked-soft border-blocked-line'
      case 'skipped': return 'bg-skipped-soft border-skipped-line'
      default: return 'bg-surface border-line'
    }
  }

  const failModalItem = failModalItemId ? items.find((i) => i.id === failModalItemId) : null
  const blockedModalItem = blockedModalItemId ? items.find((i) => i.id === blockedModalItemId) : null

  return (
    <>
      {/* Session header */}
      <div className="sticky top-[53px] z-30 bg-surface border-b border-line shadow-sm">
        <div className="max-w-content mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <SessionMood passTrigger={passTrigger} failTrigger={failTrigger} isComplete={isComplete} />
              <div className="flex items-center gap-2 flex-wrap text-xs text-ink-soft">
              <span className="font-semibold text-ink">{qaSession.user_type}</span>
              <span className="text-ink-muted">·</span>
              <span>{qaSession.viewport}</span>
              <span className="text-ink-muted">·</span>
              <span>{qaSession.operating_system}</span>
              <span className="text-ink-muted">·</span>
              <span>{qaSession.browser}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-ink-soft">
                <span className="font-semibold text-ink">{stats.done}</span> / {stats.total} done ({pct}%)
              </span>
              <span className="inline-flex items-center gap-1 text-pass font-medium"><span className="h-1.5 w-1.5 rounded-full bg-pass" />{stats.passed}</span>
              <span className="inline-flex items-center gap-1 text-fail font-medium"><span className="h-1.5 w-1.5 rounded-full bg-fail" />{stats.failed}</span>
              <span className="inline-flex items-center gap-1 text-blocked font-medium"><span className="h-1.5 w-1.5 rounded-full bg-blocked" />{stats.blocked}</span>
              <span className="inline-flex items-center gap-1 text-skipped font-medium"><span className="h-1.5 w-1.5 rounded-full bg-skipped" />{stats.skipped}</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-canvas rounded-full overflow-hidden">
            <div
              className="h-full bg-ink rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Back link + setup instructions */}
      <div className="max-w-content mx-auto px-6 pt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => router.push(backHref)}
          className="text-xs text-ink-muted hover:text-ink transition-colors"
        >
          ← {backLabel}
        </button>
        {!isComplete && (
          <CompleteSessionButton
            sessionId={qaSession.id}
            redirectTo={backHref}
          />
        )}
      </div>

      {setupInstructions && (
        <div className="max-w-content mx-auto px-6 pt-4">
          <div className="bg-surface border border-line rounded-md p-5">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Setup instructions</p>
            <div
              className="prose prose-sm max-w-none text-ink"
              dangerouslySetInnerHTML={{ __html: setupInstructions }}
            />
          </div>
        </div>
      )}

      {/* Test items */}
      <div className="max-w-content mx-auto px-6 py-6 space-y-8">
        {Array.from(grouped.entries()).map(([part, sections]) => (
          <div key={part}>
            {part !== 'General' && (
              <h2 className="text-base font-bold text-ink mb-4 pb-2 border-b border-line">
                {part}
              </h2>
            )}
            {Array.from(sections.entries()).map(([section, sectionItems]) => (
              <div key={section} className="mb-6">
                {section && (
                  <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                    {section}
                  </h3>
                )}
                <div className="space-y-3">
                  {sectionItems.map((item) => {
                    const result = results.get(item.id)
                    const status = result?.status as ResultStatus | undefined
                    const isSaving = savingKey?.startsWith(`${item.id}:`) ?? false
                    const savingPass = savingKey === `${item.id}:pass`
                    const savingSkipped = savingKey === `${item.id}:skipped`

                    return (
                      <div
                        key={item.id}
                        className={`rounded-md border p-4 transition-colors ${getStatusStyle(status)}`}
                      >
                        {/* Item header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {item.tc_number && (
                                <span className="text-xs text-ink-muted font-mono">{item.tc_number}</span>
                              )}
                              {item.feature_area && (
                                <span className="text-xs text-ink-soft bg-canvas px-2 py-0.5 rounded-full border border-line">
                                  {item.feature_area}
                                </span>
                              )}
                              {item.platform && (
                                <span className="text-xs text-ink-muted">{item.platform}</span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-ink leading-snug">
                              {item.test_description}
                            </p>
                          </div>
                        </div>

                        {/* Steps */}
                        {item.steps && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">What to do</p>
                            <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{item.steps}</p>
                          </div>
                        )}

                        {/* Expected result */}
                        {item.expected_result && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">What should happen</p>
                            <p className="text-sm text-ink-soft leading-relaxed">{item.expected_result}</p>
                          </div>
                        )}

                        {/* Blocked note if present */}
                        {status === 'blocked' && result?.blocked_note && (
                          <div className="mb-3 px-3 py-2 bg-blocked-soft border border-blocked-line rounded-xs">
                            <p className="text-xs text-blocked">{result.blocked_note}</p>
                          </div>
                        )}

                        {/* Fail summary if present */}
                        {status === 'fail' && result?.actual_behavior && (
                          <div className="mb-3 px-3 py-2 bg-fail-soft border border-fail-line rounded-xs">
                            <p className="text-xs text-fail">{result.actual_behavior}</p>
                          </div>
                        )}

                        {/* Acknowledged badge */}
                        {status === 'fail' && result?.acknowledged_at && (
                          <div className="mb-3 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-canvas border border-line rounded-full text-xs text-ink-soft">
                              ✓ Seen by admin
                            </span>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleQuickStatus(item, 'pass')}
                            disabled={isSaving}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                              status === 'pass'
                                ? 'bg-pass text-white border-pass'
                                : 'bg-canvas border-line text-ink hover:bg-pass-soft hover:border-pass-line hover:text-pass'
                            }`}
                          >
                            {savingPass ? (
                              <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : null} Pass
                          </button>
                          <button
                            onClick={() => setFailModalItemId(item.id)}
                            disabled={isSaving}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                              status === 'fail'
                                ? 'bg-fail text-white border-fail'
                                : 'bg-canvas border-line text-ink hover:bg-fail-soft hover:border-fail-line hover:text-fail'
                            }`}
                          >
                            Fail
                          </button>
                          <button
                            onClick={() => setBlockedModalItemId(item.id)}
                            disabled={isSaving}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                              status === 'blocked'
                                ? 'bg-blocked text-white border-blocked'
                                : 'bg-canvas border-line text-ink hover:bg-blocked-soft hover:border-blocked-line hover:text-blocked'
                            }`}
                          >
                            Blocked
                          </button>
                          <button
                            onClick={() => handleQuickStatus(item, 'skipped')}
                            disabled={isSaving}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                              status === 'skipped'
                                ? 'bg-skipped text-white border-skipped'
                                : 'bg-canvas border-line text-ink hover:bg-skipped-soft hover:border-skipped-line hover:text-skipped'
                            }`}
                          >
                            {savingSkipped ? (
                              <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : null} Skip / N/A
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Modals */}
      {failModalItem && (
        <FailModal
          sessionId={qaSession.id}
          projectId={qaSession.project_id}
          testItemId={failModalItem.id}
          testDescription={failModalItem.test_description}
          existingResult={results.get(failModalItem.id) ?? null}
          previousUsernames={previousUsernames}
          onClose={() => setFailModalItemId(null)}
          onSaved={() => {
            handleResultSaved(failModalItem.id)
            setFailTrigger((n) => n + 1)
            setFailModalItemId(null)
          }}
        />
      )}

      {blockedModalItem && (
        <BlockedModal
          sessionId={qaSession.id}
          testItemId={blockedModalItem.id}
          testDescription={blockedModalItem.test_description}
          existingNote={results.get(blockedModalItem.id)?.blocked_note ?? null}
          onClose={() => setBlockedModalItemId(null)}
          onSaved={() => {
            handleResultSaved(blockedModalItem.id)
            setBlockedModalItemId(null)
          }}
        />
      )}
    </>
  )
}
