import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'
type Shape = 'rounded' | 'pill'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-teal-800 text-on-inverse hover:bg-teal-900 active:bg-teal-900 border border-transparent',
  secondary: 'bg-surface text-ink border border-line hover:border-line-hover hover:bg-canvas',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-sunken',
  danger: 'bg-fail text-on-inverse border border-transparent hover:opacity-90 active:opacity-90',
}

const SIZE: Record<Size, string> = {
  sm: 'h-[34px] px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-6 text-base gap-2',
}

// The system's primary action control. Variants: primary (teal) · secondary
// (outline) · ghost · danger. shape="pill" for playful surfaces, "rounded" for
// dense work tools. Handles hover/press/disabled/loading.
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  className,
  disabled,
  ...rest
}: {
  variant?: Variant
  size?: Size
  shape?: Shape
  loading?: boolean
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
  fullWidth?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const off = disabled || loading
  return (
    <button
      disabled={off}
      className={cn(
        'inline-flex items-center justify-center font-semibold leading-none tracking-[-0.004em]',
        'transition-[background,border-color,transform,opacity] duration-150 ease-out',
        'active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
        shape === 'pill' ? 'rounded-md' : 'rounded-md',
        fullWidth && 'w-full',
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner size={16} className="text-current" />}
      {!loading && iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  )
}
