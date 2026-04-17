'use client'

import { useState, useMemo } from 'react'
import type { QATestItem } from '@/lib/db/qa-test-items'
import type { QAResult } from '@/lib/db/qa-results'
import type { QASession } from '@/lib/db/qa-sessions'
import { FailModal } from './FailModal'
import { BlockedModal } from './BlockedModal'

interface TestChecklistProps {
  qaSession: QASession
  items: QATestItem[]
  initialResults: QAResult[]
  previousUsernames: string[]
}

type ResultStatus = 'pass' | 'fail' | 'blocked' | 'skipped' | 'not_tested'

export function TestChecklist({
  qaSession,
  items,
  initialResults,
  previousUsernames,
}: TestChecklistProps) {
  // Map test_item_id → result
  const [results, setResults] = useState<Map<string, QAResult>>(() => {
    const map = new Map<string, QAResult>()
    for (const r of initialResults) map.set(r.test_item_id, r)
    return map
  })

  const [failModalItemId, setFailModalItemId] = useState<string | null>(null)
  const [blockedModalItemId, setBlockedModalItemId] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)

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
    setSavingItemId(item.id)
    try {
      const res = await fetch(`/api/qa/sessions/${qaSession.id}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_item_id: item.id, status }),
      })
      if (res.ok) {
        const data = await res.json()
        setResults((prev) => new Map(prev).set(item.id, data.result))
      }
    } finally {
      setSavingItemId(null)
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
      case 'pass': return 'bg-status-pass border-status-pass-border'
      case 'fail': return 'bg-status-fail border-status-fail-border'
      case 'blocked': return 'bg-status-blocked border-status-blocked-border'
      case 'skipped': return 'bg-status-skipped border-status-skipped-border'
      default: return 'bg-surface border-warm-border'
    }
  }

  const failModalItem = failModalItemId ? items.find((i) => i.id === failModalItemId) : null
  const blockedModalItem = blockedModalItemId ? items.find((i) => i.id === blockedModalItemId) : null

  return (
    <>
      {/* Session header */}
      <div className="sticky top-[57px] z-30 bg-surface border-b border-warm-border shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap text-xs text-ink-2">
              <span className="font-semibold text-ink">{qaSession.user_type}</span>
              <span className="text-ink-3">·</span>
              <span>{qaSession.viewport}</span>
              <span className="text-ink-3">·</span>
              <span>{qaSession.operating_system}</span>
              <span className="text-ink-3">·</span>
              <span>{qaSession.browser}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-ink-2">
                <span className="font-semibold text-ink">{stats.done}</span> / {stats.total} done ({pct}%)
              </span>
              <span className="text-status-pass-text font-medium">✅ {stats.passed}</span>
              <span className="text-status-fail-text font-medium">❌ {stats.failed}</span>
              <span className="text-status-blocked-text font-medium">🚧 {stats.blocked}</span>
              <span className="text-status-skipped-text font-medium">⏭ {stats.skipped}</span>
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

      {/* Test items */}
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-8">
        {Array.from(grouped.entries()).map(([part, sections]) => (
          <div key={part}>
            {part !== 'General' && (
              <h2 className="text-base font-bold text-ink mb-4 pb-2 border-b border-warm-border">
                {part}
              </h2>
            )}
            {Array.from(sections.entries()).map(([section, sectionItems]) => (
              <div key={section} className="mb-6">
                {section && (
                  <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-3">
                    {section}
                  </h3>
                )}
                <div className="space-y-3">
                  {sectionItems.map((item) => {
                    const result = results.get(item.id)
                    const status = result?.status as ResultStatus | undefined
                    const isSaving = savingItemId === item.id

                    return (
                      <div
                        key={item.id}
                        className={`rounded-[12px] border p-4 transition-colors ${getStatusStyle(status)}`}
                      >
                        {/* Item header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {item.tc_number && (
                                <span className="text-xs text-ink-3 font-mono">{item.tc_number}</span>
                              )}
                              {item.feature_area && (
                                <span className="text-xs text-ink-2 bg-canvas px-2 py-0.5 rounded-full border border-warm-border">
                                  {item.feature_area}
                                </span>
                              )}
                              {item.platform && (
                                <span className="text-xs text-ink-3">{item.platform}</span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-ink leading-snug">
                              {item.test_description}
                            </p>
                          </div>
                          {isSaving && (
                            <svg className="w-4 h-4 animate-spin text-ink-3 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                        </div>

                        {/* Steps */}
                        {item.steps && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-1">What to do</p>
                            <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">{item.steps}</p>
                          </div>
                        )}

                        {/* Expected result */}
                        {item.expected_result && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-1">What should happen</p>
                            <p className="text-sm text-ink-2 leading-relaxed">{item.expected_result}</p>
                          </div>
                        )}

                        {/* Blocked note if present */}
                        {status === 'blocked' && result?.blocked_note && (
                          <div className="mb-3 px-3 py-2 bg-status-blocked border border-status-blocked-border rounded-[8px]">
                            <p className="text-xs text-status-blocked-text">{result.blocked_note}</p>
                          </div>
                        )}

                        {/* Fail summary if present */}
                        {status === 'fail' && result?.actual_behavior && (
                          <div className="mb-3 px-3 py-2 bg-status-fail border border-status-fail-border rounded-[8px]">
                            <p className="text-xs text-status-fail-text">{result.actual_behavior}</p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleQuickStatus(item, 'pass')}
                            disabled={isSaving}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                              status === 'pass'
                                ? 'bg-status-pass-text text-white border-status-pass-text'
                                : 'bg-canvas border-warm-border text-ink hover:bg-status-pass hover:border-status-pass-border hover:text-status-pass-text'
                            }`}
                          >
                            ✅ Pass
                          </button>
                          <button
                            onClick={() => setFailModalItemId(item.id)}
                            disabled={isSaving}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                              status === 'fail'
                                ? 'bg-status-fail-text text-white border-status-fail-text'
                                : 'bg-canvas border-warm-border text-ink hover:bg-status-fail hover:border-status-fail-border hover:text-status-fail-text'
                            }`}
                          >
                            ❌ Fail
                          </button>
                          <button
                            onClick={() => setBlockedModalItemId(item.id)}
                            disabled={isSaving}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                              status === 'blocked'
                                ? 'bg-status-blocked-text text-white border-status-blocked-text'
                                : 'bg-canvas border-warm-border text-ink hover:bg-status-blocked hover:border-status-blocked-border hover:text-status-blocked-text'
                            }`}
                          >
                            🚧 Blocked
                          </button>
                          <button
                            onClick={() => handleQuickStatus(item, 'skipped')}
                            disabled={isSaving}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                              status === 'skipped'
                                ? 'bg-status-skipped-text text-white border-status-skipped-text'
                                : 'bg-canvas border-warm-border text-ink hover:bg-status-skipped hover:border-status-skipped-border hover:text-status-skipped-text'
                            }`}
                          >
                            ⏭ Skip / N/A
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
