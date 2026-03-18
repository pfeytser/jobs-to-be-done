'use client'

import { useState } from 'react'

interface VoteCardProps {
  id: string
  situation: string
  motivation: string
  expectedOutcome: string
  totalVotes: number
  myVotes: number
  remainingVotes: number
  onVote: (entryId: string, action: 'add' | 'remove') => Promise<void>
  disabled?: boolean
  discussionMode?: boolean
  rank?: number
}

export function VoteCard({
  id,
  situation,
  motivation,
  expectedOutcome,
  totalVotes,
  myVotes,
  remainingVotes,
  onVote,
  disabled = false,
  discussionMode = false,
  rank,
}: VoteCardProps) {
  const [voting, setVoting] = useState(false)

  async function handleVote(action: 'add' | 'remove') {
    if (disabled || voting) return
    setVoting(true)
    try {
      await onVote(id, action)
    } finally {
      setVoting(false)
    }
  }

  const canAdd = !disabled && remainingVotes > 0 && !voting
  const canRemove = !disabled && myVotes > 0 && !voting

  return (
    <div className={`bg-surface rounded-[14px] border p-5 transition-all ${
      myVotes > 0 ? 'border-ink' : 'border-warm-border'
    }`} style={{ boxShadow: '0 1px 2px rgba(17,34,32,0.06)' }}>
      <div className="flex items-start gap-4">
        {/* Rank / vote badge (discussion mode only) */}
        {discussionMode && (
          <div className="shrink-0 text-center">
            {rank !== undefined ? (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base ${
                rank === 1 ? 'bg-gold text-ink' :
                rank === 2 ? 'bg-sand text-ink' :
                rank === 3 ? 'bg-warm-border text-ink' :
                'bg-canvas text-ink-3'
              }`}>
                {rank}
              </div>
            ) : null}
            <div className="text-xs text-ink-3 mt-1">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink leading-relaxed mb-2">
            <strong>When</strong> {situation},{' '}
            <strong>I want to</strong> {motivation},{' '}
            <strong>so I can</strong> {expectedOutcome}.
          </p>

          {!discussionMode && myVotes > 0 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: myVotes }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-ink" />
              ))}
              <span className="text-xs text-ink-2 ml-1">Your votes: {myVotes}</span>
            </div>
          )}
        </div>

        {/* Vote controls */}
        {!discussionMode && (
          <div className="shrink-0 flex flex-col items-center gap-2">
            <button
              onClick={() => handleVote('add')}
              disabled={!canAdd}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-ink text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity font-bold text-lg"
              title="Add vote"
            >
              +
            </button>
            <span className="text-sm font-semibold text-ink tabular-nums w-6 text-center">
              {voting ? '…' : myVotes}
            </span>
            <button
              onClick={() => handleVote('remove')}
              disabled={!canRemove}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-canvas border border-warm-border text-ink-2 hover:border-ink hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-lg"
              title="Remove vote"
            >
              −
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
