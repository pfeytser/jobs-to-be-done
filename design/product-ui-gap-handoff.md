# Industrious Design System — Product/App Component Gap

**Handoff for the design team**
Prepared for the visual refresh of the internal "Jobs to Bee Done" (JTBD) app.

---

## 1. Context — please read first

The delivered **Industrious Design System** (`/industrious-design-system`) is excellent, but it is explicitly a **marketing-site** system — its own README and SKILL state *"No product/app UI kit."* It gives us:

- ✅ Complete **foundations** — palette (Teal · Ocean · Sky · Honey · Sunset · Almond · Red · Grey) with semantic aliases, type scale, radii, spacing (4px grid), shadows, motion, focus ring.
- ✅ **Type & voice** — Tiempos Headline + Hanken Grotesk, casing/voice rules.
- ✅ A few **primitives & marketing modules** — Button (primary/tertiary/honey/ghost/pill), basic input/textarea/checkbox, StatsBand, a modal pattern (TourModal), Nav, Footer, AlertBar, Hero, Quote, CTA, LocationGrid, Solutions.

What it does **not** cover is the **product/app UI** our app is built from — data tables, full form controls, status badges, toasts, tabs, pagination, empty/loading states, etc. This document is the precise list of those missing components so they can be designed as a **Product/App extension** of the existing brand system.

**Build on the existing tokens.** Every component below should reference the tokens already defined in `colors_and_type.css` (`var(--teal-700)`, `var(--almond-100)`, `var(--radius-md)`, `var(--shadow-sm)`, etc.). We do **not** want a parallel token set. New tokens should only be introduced where this document explicitly calls one out as an open question.

**Target stack:** the app is **Next.js + Tailwind v4**. Deliverables as Figma components with variants/states are ideal; the existing CSS+JSX kit is treated as reference, not drop-in.

---

## 2. Open brand decisions (need a design ruling)

These are genuine conflicts between our app's needs and the brand rules. We're deferring them to you:

1. **Status colors — there is no "success/green" in the palette.** The app's QA and Expenses features rely on a 4-state status system: **pass / fail / blocked / skipped** (today: green / red / amber / grey). The brand palette has red (error), honey + sunset (warm accents), teal/ocean/sky (cool) — but **no green**. Please decide either:
   - (a) map onto the existing palette (e.g. pass→teal, fail→red, blocked→sunset or honey, skipped→grey), accepting that "green = success" goes away; **or**
   - (b) sanction one new on-brand success-green token used *only* for status.
   Each status needs a **bg / border / text** triplet (matching how the app's status families work today).

2. **Emoji replacement.** The brand bans emoji in product, but the app currently uses them as meaningful UI: 🐝 (logo), 🧪 (QA), ✅ ❌ 🚧 ⏭ (status), 🌊 (avatar fallback), etc. Each needs an **icon** replacement. The shipped icon set is small/marketing-oriented, so please either expand the custom icon set to cover product UI or bless a specific **Heroicons Outline** subset as the sanctioned substitute (see #3).

3. **Product icon set.** The app needs many UI icons the brand set doesn't include: chevrons (up/down/left/right), sort arrows (▲▼↕), close (×), trash, copy, search, upload/file, download/export, plus/minus, warning/alert, info, drag handle, external-link, check. Please confirm the substitution source and stroke spec so they read as one family with the custom icons.

4. **Loading & motion stance.** The brand prizes "stillness" (the README notes the hero button *never* animates). But a product app has real async waits (imports, AI image generation 20–30s, autosave, matcher runs). We need a sanctioned approach to **spinners, skeletons, and progress** that still feels on-brand. Please rule on: spinner style, whether to use **skeleton loaders** (none exist today), and progress-bar treatment.

5. **Net-new patterns with no brand precedent.** **Tooltip**, **branded confirm dialog**, and **toast** don't exist in the system today (the app currently uses native `confirm()`/`alert()` and an ad-hoc toast). These should be designed fresh.

6. **Consolidation.** Our current app has an inconsistent radius scale (6 values) and 4 container widths. The new system's radii (`--radius-xs/sm/md/lg/xl/2xl/pill`) are cleaner — please confirm which radius maps to which product element so we don't reintroduce sprawl.

---

## 3. The component gap list

Grouped by category. For each: **variants** needed and the **states** to design. Unless noted, "all interactive states" = default · hover · focus (use `--focus-ring`) · active/pressed · disabled.

### A. Buttons & actions (extend the existing Button)
The existing Button covers primary/tertiary/honey/ghost/pill. Still needed:
- **Destructive / danger button** — solid + outline. States: all + loading.
- **Icon-only button** — sizes sm/md; square + round. All states.
- **Loading button** — spinner-in-button treatment (see open question #4).
- **Multi-state segmented status buttons** — a connected group of Pass / Fail / Blocked / Skip selectors; each shows selected vs unselected (depends on #1).
- **Two-click confirm button** — inline "click again to confirm" destructive pattern (default → armed → in-progress).
- **Button group / toolbar** — buttons sitting together (used in editor toolbars, export row).

### B. Form controls
- **Text input** — full states incl. **error** and **disabled** (the preview shows only a default). With optional **leading/trailing adornment** and a **prefix-label** variant (inline label inside the field).
- **Search input** — with leading search icon + optional clear.
- **Textarea** — default + **auto-grow** behavior; error/disabled states.
- **Select / dropdown (native-styled)** — including **optgroup** rendering. All states + error.
- **Custom dropdown menu / popover** — for menus that aren't a native select (e.g. the admin nav menu): trigger + floating panel, sectioned, with hover/active items.
- **Checkbox** — full states (default/checked/indeterminate/disabled/focus) + a **checkbox-row** layout (label + description).
- **Radio group** — both as classic radios and as **button-toggle** segmented groups.
- **Toggle / switch** — a real switch (today it's faked with buttons). On/off/disabled/focus.
- **Filter controls** — a coherent filter bar set: **filter-select**, **filter-text** ("contains…"), **date-range** (two date inputs + separator), and a **"N filters active · Clear all"** summary row.
- **Sortable column header** — label + sort indicator (none/asc/desc), hover + active.
- **Field anatomy** — the canonical **label / helper text / inline error** layout, plus required indicator and validation states. This is the single most-reused pattern across every form in the app.

### C. Data display
- **Data table / grid** — *highest priority.* Header row, body rows (hover, selected, zebra optional), numeric right-alignment, truncation/wrapping, **editable cells**, **status-badge cells**, sticky header, footer/empty row, and a dense vs comfortable density. Used in Expenses (12-col), QA admin, translation.
- **Card variants** — the marketing card exists; we also need: **feature/navigation card** (title + description + meta + status badge + chevron — appears in 5+ places), **content/data card**, and **list-style card**.
- **Stat / summary card** — single big number + label, arranged in 2-up/4-up grids (StatsBand is marketing-styled; we need a compact product variant).
- **List rows** — item row, settings row, key/value row.
- **Section header** — title + count + actions (e.g. "Expense Transactions — 45 · $2,345.67").

### D. Status, badges & metadata
- **Status badge / pill** — the full tone set: neutral, success/pass, warning/blocked, error/fail, skipped, completed, plus special (honey "featured"). Depends on open question #1. Needs **bg/border/text** per tone.
- **Type / category tag pill** — read-only.
- **Removable chip** — tag with × (default/hover/focus on the remove control).
- **Count badge / numeric indicator.**

### E. Feedback & status communication
- **Toast** — transient notification (success/info/error tones), with auto-dismiss + optional action. *Net-new.*
- **Inline alert / banner** — success / info / warning / error, with optional action button (distinct from the marketing AlertBar).
- **Inline field messages** — error and warning text beneath a field.
- **Empty state** — two flavors: "no data yet + primary CTA" and "search to begin" (illustration or typographic, per brand — no stock).
- **Loading states** — spinner, "loading…" text, **skeleton** (open question #4), and per-slot states for long async (e.g. image generation: generating / failed+retry / not-requested).
- **Progress bar** — linear with %/count; plus an optional **meter/strength bar**.
- **Step / dot indicator** — for multi-step flows and slideshow navigation.

### F. Overlays
- **Modal / dialog** — generalize the TourModal into a reusable dialog: backdrop, panel, header w/ close, body, footer; sizes sm/md/lg; scrollable body; Esc + click-outside dismiss.
- **Confirm dialog** — destructive confirm with title/body/cancel/confirm. *Net-new* (replaces native `confirm()`).
- **Tooltip** — small hover/focus hint. *Net-new.*
- **Dropdown menu / popover** — see B (listed once).

### G. In-page navigation
- **Tabs / segmented control** — used for filters and language switching (pill tabs exist as buttons but not as a component with active/selected semantics).
- **Pagination** — prev/next + "Page n of m"; optional numbered.
- **Accordion / disclosure** — single + group; the FAQ frame exists in Figma but no shippable component.
- **Breadcrumb** — for the app header.

### H. App chrome (product, not marketing)
- **App header** — distinct from the marketing Nav: product logo/breadcrumb + section name + **admin menu dropdown** + **account cluster** (avatar + name + sign-out).
- **Avatar** — image + initial/emoji fallback + loading; sizes.
- **Page-load progress indicator** (top loader) — styled on-brand.

---

## 4. Specialized / bespoke components (FYI — lower priority)

These are app-specific and we can build them on the new tokens, but flagging them so the system anticipates them visually:

- **Tag chip editor** (translation) — protected inline "tag chips" inside an editable field, with a formatting toolbar, plus empty/invalid/error states. Needs a chip treatment that's clearly *non-editable* and pairs (open/close).
- **Voting UI** (two-truths) — rank badge, vote-tally dots, +/− controls.
- **Reveal / celebration moment** — currently confetti (brand says no bounce/overshoot — please advise a tasteful alternative).
- **Presentation / slideshow mode** (storyboard) — slide canvas, dot nav, prev/next, image states.
- **Scene editor** (storyboard) — reorderable cards (move up/down / drag).
- **Sentiment analysis viz** (JTBD) — colored cluster grid + strength bars + quote block.
- **Countdown timer** (QA) — normal / urgent / expired states.

---

## 5. States matrix (please cover every cell)

| Component | default | hover | focus | active/selected | disabled | loading | error | empty |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Buttons (all variants) | ● | ● | ● | ● | ● | ● | – | – |
| Text input / textarea / select | ● | ● | ● | – | ● | – | ● | – |
| Checkbox / radio / toggle | ● | ● | ● | ● | ● | – | ● | – |
| Filter controls | ● | ● | ● | ● | ● | ● | – | ● |
| Sortable header | ● | ● | ● | ● (asc/desc) | – | – | – | – |
| Data table | ● | ● (row) | ● (cell) | ● (row/cell) | – | ● | – | ● |
| Status badge / chip | ● | – | – | – | – | – | – | – |
| Tabs / segmented | ● | ● | ● | ● | ● | – | – | – |
| Pagination | ● | ● | ● | ● | ● (ends) | – | – | – |
| Accordion | ● (collapsed) | ● | ● | ● (expanded) | – | – | – | – |
| Modal / confirm / dialog | ● | – | ● (within) | – | – | – | – | – |
| Tooltip | ● | – | – | – | – | – | – | – |
| Toast / inline alert | ● (×tones) | – | – | – | – | – | – | – |
| Progress / meter / steps | ● | – | – | ● (current) | – | ● | – | – |
| Avatar | ● | – | – | – | – | ● | – | ● (fallback) |

(● = needed, – = N/A)

---

## 6. Suggested priority

- **P0 — blocks the app rebrand:** field anatomy + core inputs, select/dropdown, **data table**, status badges (+ open question #1), tabs, pagination, modal + confirm, toast/inline alert, empty + loading states, app header.
- **P1 — high-traffic polish:** filter bar, sortable headers, stat cards, accordion, tooltip, avatar, removable chips, progress.
- **P2 — specialized:** the §4 bespoke components.

---

## 7. Deliverable request

For each component above: a Figma component with **variants + states**, built on the existing `colors_and_type.css` tokens (no new token set), with notes on spacing/radius/typography token usage. Where a brand decision from §2 is required, a recommendation + rationale would help us move fast.

*Reference: the full pre-refresh component inventory of the app is available on request — this document is that inventory minus what the current marketing system already covers.*
