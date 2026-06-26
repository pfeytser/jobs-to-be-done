import { cn } from '@/lib/cn'

// Static sunken block with a slow opacity pulse — NO shimmer sweep (a moving
// gradient reads as a gradient, which the brand bans).
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse-soft rounded-md bg-sunken', className)} />
}
