'use client'

import { useState } from 'react'

interface Example {
  situation: string
  motivation: string
  outcome: string
}

const INSTAGRAM_GENERAL: Example[] = [
  {
    situation: 'I have a few minutes between meetings',
    motivation: 'quickly browse visually interesting content',
    outcome: 'feel entertained and mentally recharged',
  },
  {
    situation: 'I discover a new restaurant or product I like',
    motivation: 'save it for easy reference later',
    outcome: 'remember where I found it when I need it',
  },
  {
    situation: 'I accomplish something I&apos;m proud of',
    motivation: 'share it with people who know me',
    outcome: 'feel seen and connected to my community',
  },
]

const INSTAGRAM_STORIES: Example[] = [
  {
    situation: 'I&apos;m out doing something fun in the moment',
    motivation: 'share a quick, casual update without it living on my profile forever',
    outcome: 'stay connected with friends without curating my permanent feed',
  },
  {
    situation: 'I see a story from someone I care about',
    motivation: 'react or reply quickly and privately',
    outcome: 'maintain the feeling of closeness without starting a full conversation',
  },
  {
    situation: 'I want to promote something to my audience',
    motivation: 'create an urgent, time-limited call to action',
    outcome: 'drive immediate engagement before the moment passes',
  },
]

interface ExamplesModalProps {
  onClose: () => void
}

export function ExamplesModal({ onClose }: ExamplesModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'stories'>('general')

  const examples = activeTab === 'general' ? INSTAGRAM_GENERAL : INSTAGRAM_STORIES
  const label = activeTab === 'general' ? 'Instagram (General)' : 'Instagram Stories'

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-[14px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" style={{ boxShadow: '0 8px 32px rgba(17,34,32,0.12)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warm-border">
          <div>
            <h2 className="text-lg font-bold text-ink">JTBD Examples</h2>
            <p className="text-sm text-ink-3 mt-0.5">
              &ldquo;When [situation], I want to [motivation], so I can [expected outcome].&rdquo;
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink transition-colors p-1.5 rounded-lg hover:bg-canvas"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'general'
                ? 'bg-ink text-white'
                : 'bg-canvas border border-warm-border text-ink-2 hover:text-ink hover:border-ink'
            }`}
          >
            Instagram (General)
          </button>
          <button
            onClick={() => setActiveTab('stories')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'stories'
                ? 'bg-ink text-white'
                : 'bg-canvas border border-warm-border text-ink-2 hover:text-ink hover:border-ink'
            }`}
          >
            Instagram Stories
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <p className="text-xs text-ink-3 uppercase tracking-wide font-medium">
            {label} — 3 examples
          </p>
          {examples.map((ex, i) => (
            <div
              key={i}
              className="bg-canvas border border-warm-border rounded-[14px] p-4"
            >
              <p className="text-sm text-ink leading-relaxed">
                <strong>When</strong>{' '}
                {ex.situation},{' '}
                <strong>I want to</strong>{' '}
                {ex.motivation},{' '}
                <strong>so I can</strong>{' '}
                {ex.outcome}.
              </p>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-warm-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-ink text-white rounded-full font-medium hover:opacity-90 transition-opacity text-sm"
          >
            Got it, close
          </button>
        </div>
      </div>
    </div>
  )
}
