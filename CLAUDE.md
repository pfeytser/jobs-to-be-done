# Jobs to Bee Done — project guide

Next.js 15 (App Router) workshop app. Auth via NextAuth v5 (Google, domain-locked).
Data in Turso (libSQL); files in Vercel Blob. Deployed on Vercel.

## Security invariants (do not violate)

These are load-bearing. A change that breaks one is a security regression, not a style nit.

1. **Every API route authorizes itself.** Middleware only redirects unauthenticated
   *page* requests — it does NOT gate `/api/*` by role. Every route handler MUST call an
   auth guard from `src/lib/auth/guards.ts` (`requireUser` / `requireAdmin` /
   `requireExpenseOwner`) or an equivalent `auth()` + role check. The only public routes
   are `api/auth/[...nextauth]` and `api/health`.
2. **Prefer the guards + `route()` wrapper** from `src/lib/auth/guards.ts` for new routes —
   they fail closed and turn errors into clean responses without leaking internals.
3. **Never interpolate values into SQL.** Always `turso.execute({ sql, args })` with `?`
   placeholders, or `turso.batch(...)`. No template literals with user data in SQL.
4. **Validate every request body** with a Zod schema before use, and bound string lengths
   (`.max(...)`) — especially on inputs any authenticated user can send.
5. **Enforce per-resource ownership** on anything addressed by an id from the URL/body.
   Look up user-owned resources scoped to the caller (e.g. `getStoryboard(id, userId)`),
   don't fetch by id alone and trust it.
6. **Don't over-return data.** API responses must not include other users' emails/PII,
   secrets, tokens, internal storage paths, or answers that should be hidden (e.g. the
   two-truths lie before reveal). Project to a safe shape.
7. **Never log secrets or decrypted values** (OAuth tokens, API keys, PII). Catch blocks
   return a generic error to the client; details go to `console.error` only.
8. **Any server-side `fetch()` of a user-supplied URL** must be host-allowlisted. Any
   user-supplied filename written to disk/zip must be basename-sanitized.
9. **Uploaded HTML (prototypes)** renders only in a sandboxed iframe WITHOUT
   `allow-same-origin`, and is excluded from the app CSP by design — keep it that way.

## Before shipping

- `npm run build` must pass.
- `node scripts/check-route-auth.mjs` must pass (CI enforces this).
- `npm audit --omit=dev --audit-level=high` should be clean.
- Deploy: `vercel --prod` (or push to `main` if git-connected). Keep git `main` and prod in sync.
