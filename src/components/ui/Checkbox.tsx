import { cn } from '@/lib/cn'

// Checkbox with an optional label row. Teal fill when checked, warm border at rest.
export function Checkbox({
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
      <span
        className={cn(
          'flex h-5 w-5 flex-none items-center justify-center rounded-xs border transition-colors duration-150',
          checked ? 'border-teal-800 bg-teal-800' : 'border-line bg-surface',
        )}
      >
        {checked && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-on-inverse">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label && <span>{label}</span>}
    </label>
  )
}
