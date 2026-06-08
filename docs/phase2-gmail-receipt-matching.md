# Build Gmail receipt matching for imported expense transactions (Phase 2)

## Context (already built — do not re-create)
- **Stack:** Next.js 15 App Router, TypeScript, Turso/libSQL (raw SQL, no ORM), Tailwind, NextAuth Google OAuth (login only), Vercel Blob storage (`BLOB_READ_WRITE_TOKEN`).
- **Owner-gating:** the entire Expense Reports area is private to `pfeytser@industriousoffice.com` via `src/lib/expenses/access.ts` (`isExpenseOwner`), enforced in pages (redirect), API routes (404), and `src/middleware.ts` (`EXPENSE_OWNER_PATTERNS` already covers `/expenses` and `/api/expenses`). **Every new route, API, and the worker must stay owner-only.**
- **Data:** `expense_transactions` is populated (160 real rows). Import logic lives in `src/lib/expenses/{columns,prepare}.ts`; DB access in `src/lib/db/expenses.ts`. The import already **preserves** `match_status` / `matched_receipt_file_id` / `confidence_score` on re-import — Phase 2 owns those fields.
- **Runtime decision:** worker is **Node/TypeScript**, run locally. Reuse `src/lib/db/*` and Blob SDK; do **not** reimplement DB/storage in another language.

## Decisions baked in
1. **Confidence is 0–100 integer everywhere** (`receipt_matches.confidence_score`, `expense_transactions.confidence_score`, UI). **Fix the existing `/expenses` UI**, which currently renders `Math.round(confidence_score * 100)%` (assumes 0–1) — change to `Math.round(confidence_score)%`.
2. **Storage:** Vercel Blob. `storage_provider = 'vercel_blob'`, `storage_url` = owner-gated blob URL, `storage_file_id` = blob pathname.
3. **Gmail OAuth:** one OAuth app in **testing** mode; encrypted refresh tokens at rest. Use a **dedicated** Google OAuth client (keep the NextAuth *login* client minimal) with `gmail.readonly`. **Account connection is decoupled from login** — the personal Gmail will not (and need not) pass the `industriousoffice.com` login allowlist.

## Scope confirmation
`https://www.googleapis.com/auth/gmail.readonly` is **sufficient** for search, `messages.get`, and `attachments.get`. No broader scope is required. Read-only; the worker must never delete/archive/label/send/modify mail.

---

## Schema (add to `src/lib/db/migrations.ts`, libSQL conventions: snake_case, `IF NOT EXISTS`, TEXT/INTEGER/REAL)

### `connected_email_accounts`
`id` (PK), `account_label` (e.g. `work`/`personal`), `email_address`, `provider` (default `'gmail'`), `oauth_token_reference` (**AES-256-GCM-encrypted refresh token**, base64 `nonce||ciphertext`), `token_scope`, `is_active` (INTEGER default 1), `last_authorized_at`, `last_synced_at`, `created_at`, `updated_at`. Index on `email_address`, `is_active`.

### `receipt_files`
`id` (PK), `source_type` (enum below), `storage_provider` (default `'vercel_blob'`), `storage_url`, `storage_file_id`, `file_name`, `mime_type`, `sha256_hash` (**UNIQUE** — dedup re-runs), `email_account_id` (FK→`connected_email_accounts`, nullable for `manual_upload`), `gmail_message_id`, `gmail_thread_id`, `gmail_subject`, `gmail_from`, `gmail_to`, `gmail_date`, `original_source_url`, `extracted_text`, `created_at`, `updated_at`. Indexes on `(email_account_id, gmail_message_id)`, `sha256_hash`.
`source_type` ∈ `gmail_pdf_attachment | gmail_email_body_pdf | gmail_receipt_link_pdf | gmail_receipt_link_printed_pdf | manual_upload`.

### `receipt_matches`
`id` (PK), `expense_transaction_id` (FK), `receipt_file_id` (FK, **nullable** for link/login-required candidates with no stored file yet), `confidence_score` (REAL 0–100), `match_method`, `match_status`, `matched_amount_type`, `matched_amount_value` (REAL), `matched_email_account_id` (FK), `reason_summary`, `created_at`, `updated_at`. **UNIQUE `(expense_transaction_id, receipt_file_id)`** (when file non-null); indexes on `expense_transaction_id`, `match_status`.
- `match_status` ∈ `candidate | auto_matched | approved | rejected | needs_review`
- `match_method` ∈ `gmail_pdf_attachment | gmail_email_body_pdf | gmail_link_pdf | gmail_link_printed_pdf | manual_upload`
- `matched_amount_type` ∈ `receipt_amount_original | amount_usd | unknown`

### `expense_transactions` (alter, via the existing `safeAlters` pattern)
Add `last_searched_at` TEXT (throttle re-search). Document that `matched_receipt_file_id` now references `receipt_files.id`.

**Never trust a `gmail_message_id` without its `email_account_id`** — message IDs are unique only within an account. Always pair them.

---

## Status state machine (the two enums, mapped)

| `receipt_matches.match_status` | Trigger | Effect on `expense_transactions` |
|---|---|---|
| `candidate` | conf < 60 | no change (stays `unmatched`); candidate recorded for the detail view |
| `needs_review` | conf 60–84, **or** contention (see below) | `match_status='possible_match'` |
| `auto_matched` | conf ≥ 85 **and** uniquely attributable | `match_status='matched'`, set `matched_receipt_file_id`, `confidence_score` |
| `approved` (human) | approve button | `match_status='matched'`, set `matched_receipt_file_id`, `confidence_score` |
| `rejected` (human) | reject button | if it was the matched file → revert to `possible_match` if other candidates exist, else `unmatched` |
| — | skip-list (below) | `match_status='no_receipt_required'`, no search |

**Contention rule:** before promoting to `auto_matched`, check whether the same `(email_account_id, gmail_message_id)` (or same `receipt_file_id`) is the top candidate for **more than one** expense. If so, demote all to `needs_review`. The ten identical −443 INDUSTRIOUSOFFICE.COM reversals are the canonical case — a single refund email must not auto-attach to all ten.

---

## Real-data skip list (configurable; default ON)
Set `match_status='no_receipt_required'` and skip searching when any holds:
- `merchant` contains `CURRENCY CONVERSION FEE`, or `category` contains `Bank Fees`.
- `amount_usd < 0` (refunds/reversals — receipts won't exist for these).
- Recurring membership lines: `merchant` in {`INDUSTRIOUSOFFICE.COM`, `INDUSTRIOUS OFFICE`} **and** `category = 'Description Required'` (configurable allow-override).

Expose as `skip_rules` config so it can be tuned. Log how many rows were auto-skipped per run.

---

## Gmail OAuth (multi-account, decoupled from login)
- Dedicated Google OAuth client, scope `gmail.readonly`, `access_type=offline`, `prompt=consent` (to guarantee a refresh token).
- **Connect flow** (owner-only, separate from NextAuth): `GET /api/expenses/accounts/connect?label=work|personal` → Google consent → callback `/api/expenses/accounts/callback` resolves the account's `email_address`, encrypts the refresh token, upserts a `connected_email_accounts` row.
- **Token encryption:** AES-256-GCM. Key from a new env var (`RECEIPT_TOKEN_KEY`, 32-byte base64) or HKDF-derived from `NEXTAUTH_SECRET`. Store `nonce||ciphertext` base64 in `oauth_token_reference`. Worker decrypts with the same key (needs it in its local env).
- Management UI `/expenses/accounts`: list connected accounts (label, email, active, last synced), connect new, toggle active, disconnect (revoke + delete row).

**Prerequisites the user must do (not buildable by the agent):**
- Add `gmail.readonly` + redirect URIs to the OAuth client; add yourself + both Gmail addresses as **test users**.
- **Testing-mode caveat:** unverified restricted-scope refresh tokens expire ~weekly → periodic re-consent. Surface a clear "reconnect needed" state in `/expenses/accounts` when a token refresh fails.
- **Workspace risk:** the `industriousoffice.com` admin may block third-party apps from `gmail.readonly`. Verify the work account can actually grant it before relying on it.

---

## Search & scoring

**Query construction (corrected):** Gmail search can't reliably filter by amount. Filter by **date window + merchant/sender/keyword**, then score the amount *after* fetching the body.
- Window: `after:(expense_date − date_window_before_days)` `before:(expense_date + date_window_after_days + 1)` (Gmail `before:` is exclusive). Defaults 3 / 7.
- Tokens: normalized merchant tokens (below), optional vendor sender domain, OR-group of keywords (`receipt OR invoice OR order OR confirmation OR payment OR booking OR trip OR fare OR folio OR statement`). Search subject + body.
- Run per **active** account; fetch top N messages via `messages.get?format=full`; extract subject/from/to/date/text/HTML/attachments/links.

**Merchant normalization (use real examples):** strip processor prefixes `TST*`, `SQ *`, `PY *`, `DD *`, trailing `*`, store noise/locations; map known aliases (`UBER *TRIP`→uber/uber.com, `LYFT *RIDE…`→lyft/lyft.com, `AIR CAN*`→Air Canada/aircanada.com, `DD *DOORDASH…`→DoorDash/doordash.com, `UNITED`/`UA INFLT`→United/united.com). Sender-domain match should score **higher** than fuzzy descriptor match.

**Amount normalization for matching (distinct from import `parseAmount`):** the import parser strips all non-`[0-9.]`, which corrupts locale formats — do **not** reuse it here. Write `extractAmounts(text)` that recognizes `123.45`, `$123.45`, `USD 123.45`, `€/£123.45`, `EUR 123.45`, `1,234.56`, and comma-decimal `123,45` / `1.234,56`, returning candidate numbers. Compare to:
1. `receipt_amount_original` (priority — the originally-billed amount appears on receipts), then
2. `amount_usd`.
**Fallback:** when `receipt_amount_original` is null (USD transactions), `amount_usd` *is* the original — treat it as primary and set `matched_amount_type='amount_usd'`. Prefer exact match; allow ±$0.01 rounding tolerance only.

**Confidence (0–100), additive with caps — tune as needed:**
- Amount matches `receipt_amount_original` (or `amount_usd` when original null): **+45**
- Amount matches only `amount_usd` (and a different original existed): **+20**
- Sender domain matches normalized merchant: **+25**; merchant token in subject/from: **+15**; in body only: **+8**
- Date within window: **+10** (linear decay by distance)
- Transactional keyword in subject: **+8**; PDF attachment present: **+8**; attachment filename ∈ {receipt, invoice, folio, statement, booking}: **+7**
- **Penalties:** promotional/marketing markers (`unsubscribe`, list-headers, "sale", "% off"): **−30**; date far outside window: **−20**; weak/garbled merchant match: **−10**; same email contends across multiple expenses: force `needs_review`.
- Thresholds: **≥85** `auto_matched` (if unique) · **60–84** `needs_review` · **<60** `candidate`.

---

## Receipt acquisition
- **PDF attachments:** download via Gmail API → SHA-256 → dedup against `receipt_files.sha256_hash` → upload to Blob → `receipt_files` row (`gmail_pdf_attachment`) → `receipt_matches` row → apply status mapping.
- **Email-body PDF** (no attachment, email *is* the receipt): render HTML (fallback plain text) with **Playwright**, prepend a header block (account label, From, To, Date, Subject, `gmail_message_id`) → Blob → `receipt_files` (`gmail_email_body_pdf`). (Gmail has no native email→PDF export — render locally.)
- **Receipt links:** detect links whose text/URL contains receipt/invoice/download/pdf/billing/folio/statement/order/booking. For V1: store as candidate metadata in `original_source_url`. If a link returns a PDF **without login** → download → `gmail_receipt_link_pdf`. If it's an HTML receipt page with no login → optionally render → `gmail_receipt_link_printed_pdf`. **If login is required → do not bypass; set `needs_review`, store URL.** No portal automation.

---

## Worker (`scripts/match-gmail-receipts.ts`, run via `npx tsx`)
Pipeline: load active accounts → pull expenses where `match_status ∈ {unmatched, needs_review}` (skip `matched`/`approved`/`rejected`/`no_receipt_required`/`ignored`; respect `last_searched_at` throttle and skip-list) → per account search → build/score candidates → contention pass → acquire files → write `receipt_files`/`receipt_matches`/update `expense_transactions` → set `last_searched_at` → emit **run summary** (searched, candidates, auto-matched, needs-review, skipped, files saved, errors, per-account token health).
Config: `max_expenses_per_run`, `date_window_before_days=3`, `date_window_after_days=7`, `auto_match_threshold=85`, `possible_match_threshold=60`, `dry_run`, `skip_rules`. In `dry_run`, log decisions and write nothing.
Rate limits: respect Gmail per-user quota; batch + exponential backoff on 429/5xx.

---

## UI / API (all owner-gated)
- **`/expenses` list:** fix the confidence formatter (0–100); add receipt-attached indicator, source Gmail account, source subject/date, and reason summary (compact — full detail lives in the detail view).
- **`/expenses/[id]` (new):** transaction details; all candidate matches from **both** accounts with confidence + reason; receipt preview/download (Blob URL); source email metadata; **Approve** / **Reject** buttons; **manual upload**.
- **APIs:** `GET /api/expenses/[id]`; `POST /api/expenses/[id]/matches/[matchId]/approve|reject` (apply state-machine mapping); `POST /api/expenses/[id]/receipt` (manual upload → Blob → `receipt_files` `manual_upload` → `receipt_matches` `approved`); `GET/POST/DELETE /api/expenses/accounts*`.

## Safety / privacy
Read-only Gmail; no mail mutation. Tokens encrypted at rest. **Do not log full email bodies** — log metadata + match explanations only. `extracted_text` is intentionally *stored* in DB (for re-scoring/preview) — that's distinct from logging and is owner-gated. PDFs only in configured Blob storage. **No Coupa upload.**

## Out of scope
Coupa upload; Google/Apple Photos OCR; login-required portal automation; vendor-specific portal logic.

## Acceptance / test plan (against the real 160 rows)
1. Connect both Gmail accounts; confirm two `connected_email_accounts` rows with encrypted tokens; revoke/reconnect works.
2. Skip-list: currency-conversion-fee, negative-amount, and recurring membership rows become `no_receipt_required` without any Gmail call.
3. Uber/Lyft/United/hotel rows produce candidates; a clean single match (e.g. a United confirmation) reaches `auto_matched`; expense flips to `matched` with a Blob PDF.
4. Contention: a single refund/confirmation email that hits multiple of the ten −443 reversals is demoted to `needs_review`, not auto-attached.
5. No `gmail_message_id` is ever stored or matched without its `email_account_id`.
6. `dry_run=true` produces a full summary and writes nothing.
7. Detail view renders candidates from both accounts; approve sets `matched`; reject reverts correctly; manual upload attaches.
