import Link from 'next/link'
import { cn } from '@/lib/cn'

// Header breadcrumb: a trail of links ending in the current section.
export function Breadcrumb({
  items,
  className,
}: {
  items: { label: React.ReactNode; href?: string }[]
  className?: string
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-2 text-sm', className)}>
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-2">
            {it.href && !last ? (
              <Link href={it.href} className="text-ink-muted transition-colors hover:text-ink">
                {it.label}
              </Link>
            ) : (
              <span className={last ? 'font-semibold text-ink' : 'text-ink-muted'}>{it.label}</span>
            )}
            {!last && <span className="text-ink-muted">/</span>}
          </span>
        )
      })}
    </nav>
  )
}
