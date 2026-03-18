'use client'

import { useState } from 'react'
import { ExamplesModal } from './ExamplesModal'

export function JTBDInfoAccordion() {
  const [open, setOpen] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  return (
    <>
      {showExamples && (
        <ExamplesModal onClose={() => setShowExamples(false)} />
      )}

      <div className="mt-3 border border-warm-border rounded-[14px] overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 bg-canvas hover:bg-surface transition-colors text-left"
        >
          <span className="text-sm font-medium text-ink">What is Jobs to be Done?</span>
          <svg
            className={`w-4 h-4 text-ink-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="px-4 py-3 bg-surface border-t border-warm-border space-y-3">
            <p className="text-sm text-ink-2 leading-relaxed">
              Jobs to be done helps teams define what progress a customer is trying to make in a specific situation.
            </p>
            <p className="text-sm text-ink-3 italic">
              &ldquo;When [situation], I want to [motivation], so I can [expected outcome].&rdquo;
            </p>
            <button
              onClick={() => setShowExamples(true)}
              className="text-sm text-ink-2 hover:text-ink font-medium transition-colors underline underline-offset-2"
            >
              See some examples
            </button>
          </div>
        )}
      </div>
    </>
  )
}
