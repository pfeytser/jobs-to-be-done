'use client'

interface SentimentCardProps {
  id: string
  term: string
  isOwn: boolean
  onDelete?: (id: string) => Promise<void>
}

export function SentimentCard({ id, term, isOwn, onDelete }: SentimentCardProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface rounded-[14px] border border-warm-border" style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
      <span className="text-sm text-ink font-medium">{term}</span>
      {isOwn && onDelete && (
        <button
          onClick={() => onDelete(id)}
          className="ml-3 shrink-0 text-ink-3 hover:text-red-500 transition-colors"
          aria-label="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
