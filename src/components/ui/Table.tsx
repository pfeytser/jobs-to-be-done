import { cn } from '@/lib/cn'

// On-brand table primitives. Compose: <Table><thead><Tr><Th/>…</Tr></thead>
// <tbody><Tr><Td/>…</Tr></tbody></Table>. The wrapper supplies the rounded,
// hairline-bordered surface.
export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  )
}

export function Tr({ className, children, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('border-t border-line first:border-t-0', className)} {...rest}>
      {children}
    </tr>
  )
}

export function Th({ className, children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'bg-canvas px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-ink-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({ className, children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 text-ink', className)} {...rest}>
      {children}
    </td>
  )
}

type Dir = 'asc' | 'desc' | null

// Clickable sortable header — shows ↕ / ▲ / ▼.
export function SortHeader({
  label,
  direction,
  onSort,
  className,
}: {
  label: React.ReactNode
  direction: Dir
  onSort: () => void
  className?: string
}) {
  return (
    <Th className={cn('p-0', className)}>
      <button
        onClick={onSort}
        className="flex w-full items-center gap-1 px-4 py-2.5 text-left uppercase tracking-wide transition-colors hover:text-ink"
      >
        {label}
        <span aria-hidden className="text-ink-muted">
          {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}
        </span>
      </button>
    </Th>
  )
}
