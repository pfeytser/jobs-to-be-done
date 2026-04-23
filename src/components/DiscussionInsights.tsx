'use client'

import useSWR from 'swr'

interface JTBDDiscussionTension {
  concept1: string
  concept2: string
  description: string
}

interface JTBDDiscussionAnalysis {
  commonalities: string[]
  tensions: JTBDDiscussionTension[]
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

interface DiscussionInsightsProps {
  exerciseId: string
  initialAnalysis?: JTBDDiscussionAnalysis | null
}

export function DiscussionInsights({ exerciseId, initialAnalysis }: DiscussionInsightsProps) {
  const { data } = useSWR<{ analysis: JTBDDiscussionAnalysis | null }>(
    !initialAnalysis ? `/api/exercises/${exerciseId}/discussion-analyze` : null,
    fetcher,
    { refreshInterval: 3000 }
  )

  const analysis = initialAnalysis ?? data?.analysis ?? null

  // Still waiting for analysis to generate
  if (!analysis) {
    return (
      <div
        className="bg-surface rounded-[14px] border border-warm-border p-6"
        style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}
      >
        <div className="flex items-center gap-3 text-ink-3">
          <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Generating discussion insights…</p>
        </div>
      </div>
    )
  }

  // Hidden: commonalities and tensions panels — restore by setting to true
  const showInsights: boolean = false
  return (
    <div className="space-y-3">
      {showInsights && (
        <>
          <div
            className="bg-surface rounded-[14px] border border-warm-border overflow-hidden"
            style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}
          >
            <div className="px-5 py-4 border-b border-warm-border flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-ink-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm font-semibold text-ink">Where the group aligns</p>
            </div>
            <ul className="px-5 py-4 space-y-3">
              {analysis.commonalities.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ink shrink-0 opacity-40" />
                  <p className="text-sm text-ink leading-relaxed">{point}</p>
                </li>
              ))}
            </ul>
          </div>

          {analysis.tensions.length > 0 && (
            <div
              className="bg-surface rounded-[14px] border border-warm-border overflow-hidden"
              style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}
            >
              <div className="px-5 py-4 border-b border-warm-border flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-ink-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <p className="text-sm font-semibold text-ink">Where the group is in tension</p>
              </div>
              <div className="divide-y divide-warm-border">
                {analysis.tensions.map((tension, i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 bg-sand rounded-full text-xs font-semibold text-ink border border-warm-border">
                        {tension.concept1}
                      </span>
                      <svg className="w-3.5 h-3.5 text-ink-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <span className="px-2.5 py-1 bg-sand rounded-full text-xs font-semibold text-ink border border-warm-border">
                        {tension.concept2}
                      </span>
                    </div>
                    <p className="text-sm text-ink-2 leading-relaxed">{tension.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
