import { cn } from '@/lib/cn'

// Linear progress — teal fill on a sunken track.
export function ProgressBar({
  value,
  max = 100,
  className,
}: {
  value: number
  max?: number
  className?: string
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-sunken', className)}>
      <div className="h-full rounded-full bg-teal-800 transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}
