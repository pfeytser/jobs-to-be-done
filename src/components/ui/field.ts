import { cn } from '@/lib/cn'

// Shared field chrome for Input / Textarea / Select — cream at rest, lifts to
// white on focus with a teal ring; fail tones on error.
export function fieldClass(error?: boolean, extra?: string): string {
  return cn(
    'w-full rounded-xs border bg-almond-50 text-sm text-ink placeholder:text-ink-muted',
    'outline-none transition-[background,border-color,box-shadow] duration-150 ease-out',
    'focus:bg-surface focus:ring-2',
    'disabled:bg-sunken disabled:cursor-not-allowed disabled:opacity-70',
    error
      ? 'border-fail-line focus:border-fail focus:ring-fail-line/40'
      : 'border-line focus:border-teal-800 focus:ring-teal-600/30',
    extra,
  )
}
