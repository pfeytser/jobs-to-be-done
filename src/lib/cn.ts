// Tiny className joiner — filters falsy values. (No tailwind-merge; we control classes.)
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
