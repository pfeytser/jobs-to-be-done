import Link from 'next/link'
import { cn } from '@/lib/cn'

// The default surface: white card on canvas, 16px radius, warm hairline,
// barely-there teal shadow.
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface shadow-xs', className)} {...rest}>
      {children}
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-ink-muted transition-colors group-hover:text-ink">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

// A clickable navigation/feature tile (home picker, project lists).
export function FeatureCard({
  href,
  title,
  description,
  leading,
  trailing,
  className,
}: {
  href: string
  title: React.ReactNode
  description?: React.ReactNode
  leading?: React.ReactNode
  trailing?: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-5 shadow-xs transition-colors hover:border-line-hover',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      {trailing ?? <ChevronRight />}
    </Link>
  )
}

// Compact dashboard stat — big number + label. Optional status tone tints the number.
export function StatCard({
  label,
  value,
  tone,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  tone?: 'pass' | 'fail' | 'blocked'
  className?: string
}) {
  const toneText = tone === 'pass' ? 'text-pass' : tone === 'fail' ? 'text-fail' : tone === 'blocked' ? 'text-blocked' : 'text-ink'
  return (
    <div className={cn('rounded-md border border-line bg-surface p-4', className)}>
      <p className={cn('text-2xl font-bold', toneText)}>{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
    </div>
  )
}
