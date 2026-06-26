import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { fieldClass } from './field'

type InputProps = {
  error?: boolean
  search?: boolean
} & React.InputHTMLAttributes<HTMLInputElement>

// Single-line text input. `search` renders a leading magnifier.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, search, className, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      className={cn(fieldClass(error, 'px-4 py-3'), search && 'pl-10', className)}
      {...rest}
    />
  )
  if (!search) return input
  return (
    <div className="relative w-full">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4-4" />
      </svg>
      {input}
    </div>
  )
})
