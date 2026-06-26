'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'pass' | 'fail'
type ToastItem = { id: number; message: React.ReactNode; tone: Tone }

const TONE: Record<Tone, string> = {
  info: 'bg-ink text-on-inverse',
  pass: 'bg-pass text-on-inverse',
  fail: 'bg-fail text-on-inverse',
}

const ToastCtx = createContext<(message: React.ReactNode, tone?: Tone) => void>(() => {})

// useToast() returns a push fn: toast('Saved.') or toast('Failed', 'fail').
export function useToast() {
  return useContext(ToastCtx)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((message: React.ReactNode, tone: Tone = 'info') => {
    const id = ++nextId
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cn('max-w-[90vw] rounded-md px-4 py-2.5 text-sm shadow-lg', TONE[t.tone])}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
