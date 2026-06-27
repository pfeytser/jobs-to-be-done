import { cn } from '@/lib/cn'

// Segmented pill control — filters, language switchers. Controlled.
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T
  onChange: (value: T) => void
  items: { value: T; label: React.ReactNode }[]
  className?: string
}) {
  return (
    <div className={cn('inline-flex flex-wrap gap-2', className)} role="tablist">
      {items.map((it) => {
        const active = it.value === value
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
              active
                ? 'border-ink bg-ink text-on-inverse'
                : 'border-line bg-surface text-ink-soft hover:border-line-hover',
            )}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
