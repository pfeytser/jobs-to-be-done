import { cn } from '@/lib/cn'

type Tone = 'info' | 'pass' | 'fail' | 'blocked'

const TONE: Record<Tone, string> = {
  info: 'bg-info border-line text-ink-soft',
  pass: 'bg-pass-soft border-pass-line text-pass',
  fail: 'bg-fail-soft border-fail-line text-fail',
  blocked: 'bg-blocked-soft border-blocked-line text-blocked',
}

// Persistent inline alert/result banner (distinct from the transient Toast and
// the marketing AlertBar).
export function Banner({
  children,
  tone = 'info',
  title,
  action,
  className,
}: {
  children?: React.ReactNode
  tone?: Tone
  title?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex items-start justify-between gap-3 rounded-md border p-3 text-sm', TONE[tone], className)}>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  )
}
