import { Button } from './Button'

// Prev / next + "Page n of m". Renders nothing for a single page.
export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number
  pageCount: number
  onPage: (page: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-center gap-4 text-sm">
      <Button variant="secondary" size="sm" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        ‹ Prev
      </Button>
      <span className="text-ink-muted">
        Page {page + 1} of {pageCount}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>
        Next ›
      </Button>
    </div>
  )
}
