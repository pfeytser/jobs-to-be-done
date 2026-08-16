'use client'

export interface ToastItem {
  id: number
  msg: string
  kind: 'ok' | 'error'
}

// Bottom-right stack of transient save confirmations.
export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-md ${
            t.kind === 'error'
              ? 'border-fail-line bg-fail-soft text-fail'
              : 'border-pass-line bg-pass-soft text-pass'
          }`}
        >
          <span aria-hidden>{t.kind === 'error' ? '⚠' : '✓'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}
