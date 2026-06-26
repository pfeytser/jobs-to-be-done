import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'accent' | 'info' | 'pass' | 'fail' | 'blocked' | 'skipped'

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-canvas text-ink-muted border-line',
  accent: 'bg-accent-wash text-on-honey border-accent',
  info: 'bg-info text-ink-soft border-line',
  pass: 'bg-pass-soft text-pass border-pass-line',
  fail: 'bg-fail-soft text-fail border-fail-line',
  blocked: 'bg-blocked-soft text-blocked border-blocked-line',
  skipped: 'bg-skipped-soft text-skipped border-skipped-line',
}

// Small status/metadata pill. Use for QA/expense statuses (pass/fail/blocked/
// skipped) and neutral tags.
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-none',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
