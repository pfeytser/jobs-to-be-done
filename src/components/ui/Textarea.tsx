import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { fieldClass } from './field'

type TextareaProps = { error?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>

// Multi-line text input — same cream→white focus treatment as Input.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error, className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldClass(error, 'px-4 py-3 leading-normal resize-y'), className)}
      {...rest}
    />
  )
})
