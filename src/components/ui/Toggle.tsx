import { cn } from '@/lib/cn'

// A real on/off switch (replaces the old two-button fake toggles).
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2.5 text-sm text-ink select-none',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative h-6 w-[42px] flex-none rounded-full transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
          checked ? 'bg-teal-800' : 'bg-almond-400',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-[18px] w-[18px] rounded-full bg-surface shadow-xs transition-[left] duration-200 ease-in-out',
            checked ? 'left-[21px]' : 'left-[3px]',
          )}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  )
}
