import { cn } from '@/lib/cn'

type Variant = 'ghost' | 'surface' | 'solid'

const VARIANT: Record<Variant, string> = {
  ghost: 'bg-transparent text-ink-soft hover:bg-sunken border border-transparent',
  surface: 'bg-surface text-ink border border-line hover:border-line-hover',
  solid: 'bg-teal-800 text-on-inverse hover:bg-teal-900 border border-transparent',
}

// A square/round button for a single icon (move, close, delete, expand).
// `label` is required for accessibility (aria-label + title).
export function IconButton({
  children,
  label,
  variant = 'ghost',
  size = 36,
  shape = 'rounded',
  className,
  ...rest
}: {
  label: string
  variant?: Variant
  size?: number
  shape?: 'rounded' | 'pill'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={cn(
        'inline-flex items-center justify-center transition-[background,border-color,color] duration-150 ease-out',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
        shape === 'pill' ? 'rounded-md' : 'rounded-sm',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
