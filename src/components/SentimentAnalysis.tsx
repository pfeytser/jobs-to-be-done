'use client'

import { useState } from 'react'

interface SentimentCluster {
  label: string
  count: number
  terms: string[]
}

interface SentimentAnalysisResult {
  brandFeelingStatement: string
  brandFeelingExplanation: string
  clusters: SentimentCluster[]
}

const CLUSTER_COLORS = [
  'rgba(232, 213, 183, 0.5)',
  'rgba(200, 221, 208, 0.5)',
  'rgba(213, 200, 221, 0.5)',
  'rgba(200, 213, 221, 0.5)',
  'rgba(221, 213, 200, 0.5)',
  'rgba(221, 200, 200, 0.5)',
]

interface SentimentAnalysisProps {
  analysis: SentimentAnalysisResult
}

export function SentimentAnalysis({ analysis }: SentimentAnalysisProps) {
  const [copied, setCopied] = useState(false)

  const maxCount = Math.max(...analysis.clusters.map((c) => c.count), 1)

  function buildExportText(): string {
    const lines: string[] = [
      'EVOKE — Sentiment Design Analysis',
      '═══════════════════════════════════',
      '',
      `Brand Feeling Statement`,
      `"${analysis.brandFeelingStatement}"`,
      '',
      analysis.brandFeelingExplanation,
      '',
      'Theme Clusters',
      '──────────────',
    ]
    for (const cluster of analysis.clusters) {
      lines.push(`${cluster.label} (${cluster.count})`)
      lines.push(`  ${cluster.terms.join(', ')}`)
      lines.push('')
    }
    return lines.join('\n')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildExportText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="space-y-6">
      {/* Brand Feeling Statement */}
      <div
        className="bg-surface rounded-[14px] border border-warm-border p-6"
        style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}
      >
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-3">
          Brand Feeling Statement
        </p>
        <blockquote className="text-xl font-bold text-ink leading-snug mb-3">
          &ldquo;{analysis.brandFeelingStatement}&rdquo;
        </blockquote>
        <p className="text-sm text-ink-2 leading-relaxed">
          {analysis.brandFeelingExplanation}
        </p>
      </div>

      {/* Cluster Table */}
      <div
        className="bg-surface rounded-[14px] border border-warm-border overflow-hidden"
        style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}
      >
        <div className="px-5 py-4 border-b border-warm-border">
          <p className="text-sm font-semibold text-ink">Theme Clusters</p>
        </div>
        <div className="divide-y divide-warm-border">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_2fr_180px] px-5 py-2.5">
            <span className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Theme</span>
            <span className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Contributing Words</span>
            <span className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Strength</span>
          </div>
          {analysis.clusters.map((cluster, i) => (
            <div
              key={cluster.label}
              className="grid grid-cols-[1fr_2fr_180px] px-5 py-4 items-center"
              style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
            >
              <span className="text-sm font-semibold text-ink pr-4">{cluster.label}</span>
              <span className="text-sm text-ink-2 pr-4 leading-relaxed">
                {cluster.terms.join(', ')}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-canvas rounded-full overflow-hidden border border-warm-border">
                  <div
                    className="h-full bg-ink rounded-full transition-all"
                    style={{ width: `${(cluster.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-ink tabular-nums w-5 text-right">
                  {cluster.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-5 py-2.5 bg-canvas border border-warm-border text-ink text-sm font-medium rounded-full hover:bg-surface transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Results
            </>
          )}
        </button>
      </div>
    </div>
  )
}
