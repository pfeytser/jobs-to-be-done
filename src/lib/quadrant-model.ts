// Pure, client-safe types and constants for the theme-prioritization feature.
// This module MUST NOT import the Turso client (or anything that does), because
// client components import from here — pulling the db client into the browser
// bundle throws `URL_INVALID` at load. The server db layer (src/lib/db/quadrants.ts)
// re-exports everything here so server code can keep a single import site.

export type QuadStatus = 'setup' | 'active' | 'reveal'

/** The four fixed quadrant keys. Only the *labels* are editable per project. */
export type QuadrantKey = 'table_stakes_floor' | 'signature' | 'cut_or_defer' | 'distinctive_bet'

export const QUADRANT_KEYS: readonly QuadrantKey[] = [
  'table_stakes_floor',
  'signature',
  'cut_or_defer',
  'distinctive_bet',
] as const

export function isQuadrantKey(v: unknown): v is QuadrantKey {
  return typeof v === 'string' && (QUADRANT_KEYS as readonly string[]).includes(v)
}

/** Grid layout: top row (matters a lot) then bottom row, each left→right. */
export const QUADRANT_GRID: Record<'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight', QuadrantKey> = {
  topLeft: 'table_stakes_floor',
  topRight: 'signature',
  bottomLeft: 'cut_or_defer',
  bottomRight: 'distinctive_bet',
}

/** A theme is flagged "contested" below this agreement level (also on ties / 3+
 *  distinct quadrants). Kept as a single tunable constant per the spec. */
export const CONTESTED_THRESHOLD = 0.6

/**
 * Reveal-time interpretation of each quadrant, in the fixed importance ×
 * distinctiveness terms. Deliberately NOT shown during placement — surfacing
 * "cut or defer" etc. while people are still placing primes loss aversion. Tied
 * to the fixed quadrant semantics, so it holds even if the labels are renamed.
 */
export const QUADRANT_MEANING: Record<QuadrantKey, string> = {
  signature: 'Matters a lot and feels distinctive — the signature bets to protect and invest in.',
  table_stakes_floor: "Matters a lot but is expected — the floor we simply have to get right.",
  distinctive_bet: 'Distinctive but matters less — optional bets worth a look when there’s room.',
  cut_or_defer: 'Expected and matters less — the natural candidates to cut or defer.',
}

// ── Decisions layer ──────────────────────────────────────────────────────────
// The workshop result is frozen in amber the moment the facilitator starts
// decisions: `FrozenBoard` is a snapshot of the reveal analysis, stored once and
// never recomputed, so the "as voted" view can never drift. Freezing also seeds a
// *decided board* from the consensus placement of every theme. From then on the
// decided board is the live state — it diverges freely (moves, re-scoping, new
// themes) while the frozen snapshot stays put.

/** Where a theme on the decided board came from. */
export type DecidedOrigin = 'workshop' | 'discussion'

export interface DecidedTheme {
  id: string
  /** The voted theme this was seeded from; null when added during discussion. */
  sourceThemeId: string | null
  title: string
  items: string[]
  /** null = in the unplaced tray (arrived there via a tie, no votes, or a drag-out). */
  quadrantKey: QuadrantKey | null
  origin: DecidedOrigin
  /** Set when carved out of another theme's scope — renders as lineage. */
  derivedFromTitle: string | null
  sortOrder: number
}

export type DecisionKind = 'seeded' | 'moved' | 'rescoped' | 'added' | 'removed'

export interface DecisionLogEntry {
  id: string
  kind: DecisionKind
  themeTitle: string
  fromQuadrant: QuadrantKey | null
  toQuadrant: QuadrantKey | null
  note: string
  actorName: string
  createdAt: string
}

/** One theme's frozen vote result. Mirrors the live `ThemeReveal` shape. */
export interface FrozenThemeReveal {
  themeId: string
  title: string
  items: string[]
  votesByQuadrant: Record<QuadrantKey, number>
  totalVotes: number
  consensusQuadrant: QuadrantKey | null
  tie: boolean
  agreementScore: number
  distinctQuadrants: number
  contested: boolean
  /** Admin-only — gate before sending to participants. */
  facilitatorReference: QuadrantKey | null
}

/** The immutable record of where the vote landed. */
export interface FrozenBoard {
  frozenAt: string
  themes: FrozenThemeReveal[]
  /** themeId → named placements. Admin-only; gate before sending. */
  breakdown: Record<string, Array<{ displayName: string; quadrantKey: QuadrantKey | null }>>
}

export function isDecidedOrigin(v: unknown): v is DecidedOrigin {
  return v === 'workshop' || v === 'discussion'
}

export interface AxisLabels {
  /** Axis names shown along the edges. */
  horizontalAxis: string
  verticalAxis: string
  /** Pole captions. */
  horizontalLeft: string
  horizontalRight: string
  verticalTop: string
  verticalBottom: string
  /** The four quadrant display names, keyed by the fixed quadrant keys. */
  quadrants: Record<QuadrantKey, string>
}

// Generic, product-neutral defaults. Every label here is editable per project
// (see the axis/quadrant label editor), so teams can tailor the two dimensions
// to whatever they're prioritizing.
export const DEFAULT_AXIS_LABELS: AxisLabels = {
  horizontalAxis: 'Distinctiveness',
  verticalAxis: 'Importance',
  horizontalLeft: 'Expected',
  horizontalRight: 'Distinctive',
  verticalTop: 'Matters a lot',
  verticalBottom: 'Matters less',
  quadrants: {
    table_stakes_floor: 'Table-stakes floor',
    signature: 'Signature must-have',
    cut_or_defer: 'Cut or defer',
    distinctive_bet: 'Distinctive bet',
  },
}
