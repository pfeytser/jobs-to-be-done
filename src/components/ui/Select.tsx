import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { fieldClass } from './field'

type SelectProps = { error?: boolean } & React.SelectHTMLAttributes<HTMLSelectElement>

// Native select styled to match the system, with a chevron. Supports optgroup.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error, className, children, ...rest },
  ref,
) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(fieldClass(error, 'cursor-pointer appearance-none px-4 py-3 pr-10'), className)}
        {...rest}
      >
        {children}
      </select>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
})
