import { turso } from './client'
import { runMigrations } from './migrations'
import {
  QUADRANT_KEYS,
  QUADRANT_GRID,
  CONTESTED_THRESHOLD,
  DEFAULT_AXIS_LABELS,
  isQuadrantKey,
  isDecidedOrigin,
  type QuadStatus,
  type QuadrantKey,
  type AxisLabels,
  type DecidedOrigin,
  type DecidedTheme,
  type DecisionKind,
  type DecisionLogEntry,
  type FrozenBoard,
  type FrozenThemeReveal,
} from '../quadrant-model'

// Theme-prioritization workshop. An admin seeds a project with themes (each a
// bundle of read-only context items), then drives it through three states:
//
//   setup → active → reveal
//
// During `active`, every participant independently drags each theme into one of
// four fixed quadrants of a 2×2 (distinctiveness × importance). At `reveal` the
// group tally, disagreement ranking, and per-participant placements are shown.
// The unit placed is the *theme*, never the individual items.
//
// Pure types/constants live in src/lib/quadrant-model.ts (client-safe — no db
// client import). Re-exported here so server code keeps one import site.

export {
  QUADRANT_KEYS,
  QUADRANT_GRID,
  CONTESTED_THRESHOLD,
  DEFAULT_AXIS_LABELS,
  isQuadrantKey,
  isDecidedOrigin,
}
export type {
  QuadStatus,
  QuadrantKey,
  AxisLabels,
  DecidedOrigin,
  DecidedTheme,
  DecisionKind,
  DecisionLogEntry,
  FrozenBoard,
  FrozenThemeReveal,
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface QuadProject {
  id: string
  name: string
  status: QuadStatus
  axisLabels: AxisLabels
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
  activated_at: string | null
  revealed_at: string | null
  /** Set when the facilitator froze the reveal and started decisions. */
  frozen_at: string | null
  /** The immutable vote snapshot taken at freeze. Null until frozen. */
  frozenBoard: FrozenBoard | null
}

export interface QuadTheme {
  id: string
  project_id: string
  title: string
  items: string[]
  sort_order: number
  /** The facilitator's private reference placement. Never sent to participants;
   *  surfaced to the admin only after reveal. Null when omitted. */
  facilitator_reference: QuadrantKey | null
  created_at: string
}

export type ParticipantStatus = 'in_progress' | 'done'

export interface QuadParticipant {
  id: string
  project_id: string
  user_id: string
  display_name: string
  role: 'admin' | 'collaborator'
  status: ParticipantStatus
  joined_at: string
}

export interface QuadPlacement {
  id: string
  project_id: string
  user_id: string
  theme_id: string
  quadrant_key: QuadrantKey | null
  updated_at: string
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function parseAxisLabels(raw: unknown): AxisLabels {
  if (typeof raw !== 'string' || raw === '') return DEFAULT_AXIS_LABELS
  try {
    const p = JSON.parse(raw) as Partial<AxisLabels> & { quadrants?: Partial<Record<QuadrantKey, string>> }
    const d = DEFAULT_AXIS_LABELS
    return {
      horizontalAxis: p.horizontalAxis || d.horizontalAxis,
      verticalAxis: p.verticalAxis || d.verticalAxis,
      horizontalLeft: p.horizontalLeft || d.horizontalLeft,
      horizontalRight: p.horizontalRight || d.horizontalRight,
      verticalTop: p.verticalTop || d.verticalTop,
      verticalBottom: p.verticalBottom || d.verticalBottom,
      quadrants: {
        table_stakes_floor: p.quadrants?.table_stakes_floor || d.quadrants.table_stakes_floor,
        signature: p.quadrants?.signature || d.quadrants.signature,
        cut_or_defer: p.quadrants?.cut_or_defer || d.quadrants.cut_or_defer,
        distinctive_bet: p.quadrants?.distinctive_bet || d.quadrants.distinctive_bet,
      },
    }
  } catch {
    return DEFAULT_AXIS_LABELS
  }
}

function parseItems(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw === '') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function parseProject(row: Record<string, unknown>): QuadProject {
  return {
    id: row.id as string,
    name: row.name as string,
    status: (row.status as QuadStatus) ?? 'setup',
    axisLabels: parseAxisLabels(row.axis_labels),
    created_by: row.created_by as string,
    created_by_name: (row.created_by_name as string) ?? '',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    activated_at: (row.activated_at as string) ?? null,
    revealed_at: (row.revealed_at as string) ?? null,
    frozen_at: (row.frozen_at as string) ?? null,
    frozenBoard: parseFrozenBoard(row.frozen_board),
  }
}

/** Reads back a frozen snapshot. Tolerant by design — a snapshot written by an
 *  older shape must still render rather than break the reveal. */
function parseFrozenBoard(raw: unknown): FrozenBoard | null {
  if (typeof raw !== 'string' || raw === '') return null
  try {
    const p = JSON.parse(raw) as Partial<FrozenBoard>
    if (!Array.isArray(p.themes)) return null
    return {
      frozenAt: typeof p.frozenAt === 'string' ? p.frozenAt : '',
      themes: p.themes,
      breakdown: p.breakdown && typeof p.breakdown === 'object' ? p.breakdown : {},
    }
  } catch {
    return null
  }
}

function parseTheme(row: Record<string, unknown>): QuadTheme {
  const ref = row.facilitator_reference
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    title: (row.title as string) ?? '',
    items: parseItems(row.items),
    sort_order: Number(row.sort_order ?? 0),
    facilitator_reference: isQuadrantKey(ref) ? ref : null,
    created_at: row.created_at as string,
  }
}

function parseParticipant(row: Record<string, unknown>): QuadParticipant {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    display_name: (row.display_name as string) ?? '',
    role: (row.role as 'admin' | 'collaborator') ?? 'collaborator',
    status: (row.status as ParticipantStatus) ?? 'in_progress',
    joined_at: row.joined_at as string,
  }
}

function parsePlacement(row: Record<string, unknown>): QuadPlacement {
  const q = row.quadrant_key
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    theme_id: row.theme_id as string,
    quadrant_key: isQuadrantKey(q) ? q : null,
    updated_at: row.updated_at as string,
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Projects ────────────────────────────────────────────────────────────────────

export async function getProjectById(id: string): Promise<QuadProject | null> {
  await runMigrations()
  const result = await turso.execute({ sql: 'SELECT * FROM quad_projects WHERE id = ?', args: [id] })
  if (!result.rows[0]) return null
  return parseProject(result.rows[0] as Record<string, unknown>)
}

export async function getAllProjects(): Promise<QuadProject[]> {
  await runMigrations()
  const result = await turso.execute('SELECT * FROM quad_projects ORDER BY created_at DESC')
  return result.rows.map((r) => parseProject(r as Record<string, unknown>))
}

/** Projects a participant may see: everything past setup. */
export async function getVisibleProjects(): Promise<QuadProject[]> {
  await runMigrations()
  const result = await turso.execute(
    "SELECT * FROM quad_projects WHERE status IN ('active', 'reveal') ORDER BY created_at DESC"
  )
  return result.rows.map((r) => parseProject(r as Record<string, unknown>))
}

export async function createProject(data: {
  name: string
  axisLabels: AxisLabels
  created_by: string
  created_by_name: string
}): Promise<QuadProject> {
  await runMigrations()
  const id = newId('qp')
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO quad_projects (id, name, status, axis_labels, created_by, created_by_name, created_at, updated_at)
          VALUES (?, ?, 'setup', ?, ?, ?, ?, ?)`,
    args: [id, data.name, JSON.stringify(data.axisLabels), data.created_by, data.created_by_name, now, now],
  })
  return (await getProjectById(id))!
}

async function touch(id: string, extraSets: string[] = [], extraArgs: (string | number | null)[] = []) {
  const now = new Date().toISOString()
  const sets = ['updated_at = ?', ...extraSets]
  const args: (string | number | null)[] = [now, ...extraArgs, id]
  await turso.execute({ sql: `UPDATE quad_projects SET ${sets.join(', ')} WHERE id = ?`, args })
}

export async function updateProjectName(id: string, name: string): Promise<QuadProject | null> {
  await touch(id, ['name = ?'], [name])
  return getProjectById(id)
}

export async function updateAxisLabels(id: string, labels: AxisLabels): Promise<QuadProject | null> {
  await touch(id, ['axis_labels = ?'], [JSON.stringify(labels)])
  return getProjectById(id)
}

export async function deleteProject(id: string): Promise<void> {
  await runMigrations()
  // Children are ON DELETE CASCADE, but delete explicitly in case FKs are off.
  await turso.batch(
    [
      { sql: 'DELETE FROM quad_decision_log WHERE project_id = ?', args: [id] },
      { sql: 'DELETE FROM quad_decided_themes WHERE project_id = ?', args: [id] },
      { sql: 'DELETE FROM quad_placements WHERE project_id = ?', args: [id] },
      { sql: 'DELETE FROM quad_participants WHERE project_id = ?', args: [id] },
      { sql: 'DELETE FROM quad_themes WHERE project_id = ?', args: [id] },
      { sql: 'DELETE FROM quad_projects WHERE id = ?', args: [id] },
    ],
    'write'
  )
}

// ── Themes ──────────────────────────────────────────────────────────────────────

export async function getThemes(projectId: string): Promise<QuadTheme[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM quad_themes WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [projectId],
  })
  return result.rows.map((r) => parseTheme(r as Record<string, unknown>))
}

export async function addTheme(
  projectId: string,
  data: { title: string; items: string[]; facilitatorReference: QuadrantKey | null }
): Promise<QuadTheme> {
  await runMigrations()
  const existing = await getThemes(projectId)
  const nextOrder = existing.length
  const id = newId('qt')
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO quad_themes (id, project_id, title, items, sort_order, facilitator_reference, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, projectId, data.title, JSON.stringify(data.items), nextOrder, data.facilitatorReference, now],
  })
  await touch(projectId)
  return (await getThemes(projectId)).find((t) => t.id === id)!
}

export async function updateTheme(
  projectId: string,
  themeId: string,
  data: { title: string; items: string[]; facilitatorReference: QuadrantKey | null }
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE quad_themes SET title = ?, items = ?, facilitator_reference = ? WHERE id = ? AND project_id = ?',
    args: [data.title, JSON.stringify(data.items), data.facilitatorReference, themeId, projectId],
  })
  await touch(projectId)
}

export async function deleteTheme(projectId: string, themeId: string): Promise<void> {
  await runMigrations()
  await turso.batch(
    [
      { sql: 'DELETE FROM quad_placements WHERE project_id = ? AND theme_id = ?', args: [projectId, themeId] },
      { sql: 'DELETE FROM quad_themes WHERE id = ? AND project_id = ?', args: [themeId, projectId] },
    ],
    'write'
  )
  await touch(projectId)
}

/** Persists a new display order (array of theme ids). Unknown ids are ignored. */
export async function reorderThemes(projectId: string, orderedIds: string[]): Promise<void> {
  await runMigrations()
  const existing = await getThemes(projectId)
  const known = new Set(existing.map((t) => t.id))
  const stmts = orderedIds
    .filter((id) => known.has(id))
    .map((id, i) => ({
      sql: 'UPDATE quad_themes SET sort_order = ? WHERE id = ? AND project_id = ?',
      args: [i, id, projectId] as (string | number)[],
    }))
  if (stmts.length) await turso.batch(stmts, 'write')
  await touch(projectId)
}

/** Bulk-inserts seed themes, appending after any existing ones. */
export async function importThemes(
  projectId: string,
  themes: Array<{ title: string; items: string[]; facilitatorReference: QuadrantKey | null }>
): Promise<void> {
  await runMigrations()
  const existing = await getThemes(projectId)
  const base = existing.length
  const now = new Date().toISOString()
  const stmts = themes.map((t, i) => ({
    sql: `INSERT INTO quad_themes (id, project_id, title, items, sort_order, facilitator_reference, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      newId(`qt_${i}`),
      projectId,
      t.title,
      JSON.stringify(t.items),
      base + i,
      t.facilitatorReference,
      now,
    ] as (string | number | null)[],
  }))
  if (stmts.length) await turso.batch(stmts, 'write')
  await touch(projectId)
}

// ── Participants ─────────────────────────────────────────────────────────────────

export async function getParticipant(projectId: string, userId: string): Promise<QuadParticipant | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM quad_participants WHERE project_id = ? AND user_id = ?',
    args: [projectId, userId],
  })
  if (!result.rows[0]) return null
  return parseParticipant(result.rows[0] as Record<string, unknown>)
}

/** Registers the caller as a participant on first activity access (idempotent). */
export async function getOrCreateParticipant(
  projectId: string,
  user: { userId: string; displayName: string; role: 'admin' | 'collaborator' }
): Promise<QuadParticipant> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO quad_participants (id, project_id, user_id, display_name, role, status, joined_at)
          VALUES (?, ?, ?, ?, ?, 'in_progress', ?)
          ON CONFLICT(project_id, user_id) DO UPDATE SET display_name = excluded.display_name`,
    args: [newId('qpt'), projectId, user.userId, user.displayName, user.role, now],
  })
  return (await getParticipant(projectId, user.userId))!
}

export async function listParticipants(projectId: string): Promise<QuadParticipant[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM quad_participants WHERE project_id = ? ORDER BY joined_at ASC',
    args: [projectId],
  })
  return result.rows.map((r) => parseParticipant(r as Record<string, unknown>))
}

export async function setParticipantStatus(
  projectId: string,
  userId: string,
  status: ParticipantStatus
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE quad_participants SET status = ? WHERE project_id = ? AND user_id = ?',
    args: [status, projectId, userId],
  })
}

// ── Placements ──────────────────────────────────────────────────────────────────

export async function getPlacementsForUser(projectId: string, userId: string): Promise<QuadPlacement[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM quad_placements WHERE project_id = ? AND user_id = ?',
    args: [projectId, userId],
  })
  return result.rows.map((r) => parsePlacement(r as Record<string, unknown>))
}

export async function getAllPlacements(projectId: string): Promise<QuadPlacement[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM quad_placements WHERE project_id = ?',
    args: [projectId],
  })
  return result.rows.map((r) => parsePlacement(r as Record<string, unknown>))
}

/** Upserts one participant's placement of one theme (quadrant, or null to clear). */
export async function upsertPlacement(
  projectId: string,
  userId: string,
  themeId: string,
  quadrantKey: QuadrantKey | null
): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO quad_placements (id, project_id, user_id, theme_id, quadrant_key, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, user_id, theme_id)
          DO UPDATE SET quadrant_key = excluded.quadrant_key, updated_at = excluded.updated_at`,
    args: [newId('qpl'), projectId, userId, themeId, quadrantKey, now],
  })
}

// ── Progress / monitor ───────────────────────────────────────────────────────────

export interface ProgressStats {
  participantCount: number
  doneCount: number
  doneNames: string[]
  pendingNames: string[]
}

export async function getProgressStats(projectId: string): Promise<ProgressStats> {
  const participants = await listParticipants(projectId)
  const doneNames: string[] = []
  const pendingNames: string[] = []
  for (const p of disambiguateNames(participants)) {
    if (p.status === 'done') doneNames.push(p.display_name)
    else pendingNames.push(p.display_name)
  }
  return {
    participantCount: participants.length,
    doneCount: doneNames.length,
    doneNames,
    pendingNames,
  }
}

/** Suffixes duplicate display names by join order so the reveal can tell people
 *  apart (spec §12). Returns copies with `display_name` disambiguated. */
export function disambiguateNames<T extends { display_name: string }>(rows: T[]): T[] {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.display_name, (counts.get(r.display_name) ?? 0) + 1)
  const seen = new Map<string, number>()
  return rows.map((r) => {
    if ((counts.get(r.display_name) ?? 0) <= 1) return r
    const n = (seen.get(r.display_name) ?? 0) + 1
    seen.set(r.display_name, n)
    return { ...r, display_name: `${r.display_name} (${n})` }
  })
}

// ── Reveal analysis ──────────────────────────────────────────────────────────────

export interface ThemeReveal {
  theme: QuadTheme
  votesByQuadrant: Record<QuadrantKey, number>
  totalVotes: number
  /** The single most-voted quadrant, or null when there are no votes or a tie. */
  consensusQuadrant: QuadrantKey | null
  /** True when two or more quadrants tie for the top. */
  tie: boolean
  /** Top-quadrant votes ÷ total votes (0 when no votes). */
  agreementScore: number
  /** How many of the four quadrants received at least one vote. */
  distinctQuadrants: number
  contested: boolean
}

/** One participant's named placement of a theme (admin-only breakdown). */
export interface NamedPlacement {
  displayName: string
  quadrantKey: QuadrantKey | null
}

export interface RevealAnalysis {
  /** Per-theme tally in display order (for the consensus grid). */
  themes: ThemeReveal[]
  /** Same themes sorted most-contested → most-agreed (the debate agenda). */
  disagreement: ThemeReveal[]
  /** themeId → each participant's named placement. Admin-only; gate before sending. */
  breakdown: Record<string, NamedPlacement[]>
}

function emptyVotes(): Record<QuadrantKey, number> {
  return { table_stakes_floor: 0, signature: 0, cut_or_defer: 0, distinctive_bet: 0 }
}

function analyzeTheme(theme: QuadTheme, placements: QuadPlacement[]): ThemeReveal {
  const votesByQuadrant = emptyVotes()
  let totalVotes = 0
  for (const p of placements) {
    if (p.quadrant_key) {
      votesByQuadrant[p.quadrant_key] += 1
      totalVotes += 1
    }
  }

  let top = 0
  let topKey: QuadrantKey | null = null
  let topCount = 0
  let distinctQuadrants = 0
  for (const key of QUADRANT_KEYS) {
    const v = votesByQuadrant[key]
    if (v > 0) distinctQuadrants += 1
    if (v > top) {
      top = v
      topKey = key
      topCount = 1
    } else if (v === top && v > 0) {
      topCount += 1
    }
  }

  const tie = topCount > 1
  const agreementScore = totalVotes > 0 ? top / totalVotes : 0
  const consensusQuadrant = tie ? null : topKey
  const contested =
    totalVotes > 0 && (agreementScore < CONTESTED_THRESHOLD || distinctQuadrants >= 3 || tie)

  return {
    theme,
    votesByQuadrant,
    totalVotes,
    consensusQuadrant,
    tie,
    agreementScore,
    distinctQuadrants,
    contested,
  }
}

/**
 * Computes the full reveal for a project: per-theme tallies (only participants
 * who placed each theme are counted), the disagreement ranking, and the
 * per-participant named breakdown. Callers must gate `breakdown` to admins.
 */
export async function getRevealAnalysis(projectId: string): Promise<RevealAnalysis> {
  const [themes, placements, participants] = await Promise.all([
    getThemes(projectId),
    getAllPlacements(projectId),
    listParticipants(projectId),
  ])

  const nameByUser = new Map(disambiguateNames(participants).map((p) => [p.user_id, p.display_name]))
  const byTheme = new Map<string, QuadPlacement[]>()
  for (const p of placements) {
    if (!byTheme.has(p.theme_id)) byTheme.set(p.theme_id, [])
    byTheme.get(p.theme_id)!.push(p)
  }

  const analyzed = themes.map((theme) => analyzeTheme(theme, byTheme.get(theme.id) ?? []))

  const breakdown: Record<string, NamedPlacement[]> = {}
  for (const theme of themes) {
    const rows = (byTheme.get(theme.id) ?? [])
      .map((p) => ({ displayName: nameByUser.get(p.user_id) ?? 'Someone', quadrantKey: p.quadrant_key }))
      .filter((r) => r.quadrantKey !== null)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
    breakdown[theme.id] = rows
  }

  // Most contested first: agreement ascending, then more distinct quadrants first.
  // Themes with no votes sink to the bottom (nothing to debate).
  const disagreement = [...analyzed].sort((a, b) => {
    if (a.totalVotes === 0 && b.totalVotes === 0) return 0
    if (a.totalVotes === 0) return 1
    if (b.totalVotes === 0) return -1
    return a.agreementScore - b.agreementScore || b.distinctQuadrants - a.distinctQuadrants
  })

  return { themes: analyzed, disagreement, breakdown }
}

// ── State transitions ────────────────────────────────────────────────────────────

export async function activateProject(id: string): Promise<QuadProject | null> {
  await touch(id, ["status = 'active'", 'activated_at = ?'], [new Date().toISOString()])
  return getProjectById(id)
}

export async function revealProject(id: string): Promise<QuadProject | null> {
  await touch(id, ["status = 'reveal'", 'revealed_at = ?'], [new Date().toISOString()])
  return getProjectById(id)
}

/**
 * Reopens a revealed project back to active. Placements are preserved so people
 * can adjust rather than start over; everyone is reset to in_progress so they
 * can re-drag and re-finish (spec §12).
 */
export async function reopenProject(id: string): Promise<QuadProject | null> {
  await runMigrations()
  await turso.execute({
    sql: "UPDATE quad_participants SET status = 'in_progress' WHERE project_id = ?",
    args: [id],
  })
  await touch(id, ["status = 'active'", 'revealed_at = NULL'])
  return getProjectById(id)
}

// ── Decisions layer ──────────────────────────────────────────────────────────────
// Everything below is additive: it never reads-modify-writes quad_themes or
// quad_placements, which is what makes the frozen vote result trustworthy.

export interface DecisionActor {
  userId: string
  displayName: string
}

function parseDecidedTheme(row: Record<string, unknown>): DecidedTheme {
  const q = row.quadrant_key
  const origin = row.origin
  return {
    id: row.id as string,
    sourceThemeId: (row.source_theme_id as string) ?? null,
    title: (row.title as string) ?? '',
    items: parseItems(row.items),
    quadrantKey: isQuadrantKey(q) ? q : null,
    origin: isDecidedOrigin(origin) ? origin : 'workshop',
    derivedFromTitle: (row.derived_from_title as string) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
  }
}

function parseLogEntry(row: Record<string, unknown>): DecisionLogEntry {
  const from = row.from_quadrant
  const to = row.to_quadrant
  return {
    id: row.id as string,
    kind: (row.kind as DecisionKind) ?? 'moved',
    themeTitle: (row.theme_title as string) ?? '',
    fromQuadrant: isQuadrantKey(from) ? from : null,
    toQuadrant: isQuadrantKey(to) ? to : null,
    note: (row.note as string) ?? '',
    actorName: (row.actor_name as string) ?? '',
    createdAt: row.created_at as string,
  }
}

async function appendDecisionLog(
  projectId: string,
  actor: DecisionActor,
  entry: {
    decidedThemeId: string | null
    kind: DecisionKind
    themeTitle: string
    fromQuadrant?: QuadrantKey | null
    toQuadrant?: QuadrantKey | null
    note?: string
  }
): Promise<void> {
  await turso.execute({
    sql: `INSERT INTO quad_decision_log
            (id, project_id, decided_theme_id, kind, theme_title, from_quadrant, to_quadrant, note, actor_id, actor_name, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      newId('qdl'),
      projectId,
      entry.decidedThemeId,
      entry.kind,
      entry.themeTitle,
      entry.fromQuadrant ?? null,
      entry.toQuadrant ?? null,
      entry.note ?? '',
      actor.userId,
      actor.displayName,
      new Date().toISOString(),
    ],
  })
}

export async function getDecidedThemes(projectId: string): Promise<DecidedTheme[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM quad_decided_themes WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [projectId],
  })
  return result.rows.map((r) => parseDecidedTheme(r as Record<string, unknown>))
}

export async function getDecisionLog(projectId: string, limit = 200): Promise<DecisionLogEntry[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM quad_decision_log WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    args: [projectId, limit],
  })
  return result.rows.map((r) => parseLogEntry(r as Record<string, unknown>))
}

async function getDecidedTheme(projectId: string, decidedId: string): Promise<DecidedTheme | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM quad_decided_themes WHERE id = ? AND project_id = ?',
    args: [decidedId, projectId],
  })
  if (!result.rows[0]) return null
  return parseDecidedTheme(result.rows[0] as Record<string, unknown>)
}

/**
 * Freezes the reveal in amber and seeds the decided board from it. Idempotent —
 * calling it again on an already-frozen project is a no-op, so the snapshot can
 * never be silently retaken and the decided board can never be reset by a
 * double-click. Each theme is seeded into its consensus quadrant; ties and
 * unvoted themes are seeded unplaced for the facilitator to resolve.
 */
export async function freezeAndSeedDecisions(
  projectId: string,
  actor: DecisionActor
): Promise<{ frozen: FrozenBoard; decided: DecidedTheme[]; alreadyFrozen: boolean }> {
  await runMigrations()
  const project = await getProjectById(projectId)
  if (!project) throw new Error('Project not found')

  if (project.frozen_at && project.frozenBoard) {
    return { frozen: project.frozenBoard, decided: await getDecidedThemes(projectId), alreadyFrozen: true }
  }

  const analysis = await getRevealAnalysis(projectId)
  const now = new Date().toISOString()
  const frozen: FrozenBoard = {
    frozenAt: now,
    themes: analysis.themes.map(
      (t): FrozenThemeReveal => ({
        themeId: t.theme.id,
        title: t.theme.title,
        items: t.theme.items,
        votesByQuadrant: t.votesByQuadrant,
        totalVotes: t.totalVotes,
        consensusQuadrant: t.consensusQuadrant,
        tie: t.tie,
        agreementScore: t.agreementScore,
        distinctQuadrants: t.distinctQuadrants,
        contested: t.contested,
        facilitatorReference: t.theme.facilitator_reference,
      })
    ),
    breakdown: analysis.breakdown,
  }

  const seeds = frozen.themes.map((t, i) => ({
    sql: `INSERT INTO quad_decided_themes
            (id, project_id, source_theme_id, title, items, quadrant_key, origin, derived_from_title, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'workshop', NULL, ?, ?, ?)`,
    args: [
      newId(`qd_${i}`),
      projectId,
      t.themeId,
      t.title,
      JSON.stringify(t.items),
      t.consensusQuadrant,
      i,
      now,
      now,
    ] as (string | number | null)[],
  }))

  await turso.batch(
    [
      ...seeds,
      {
        sql: 'UPDATE quad_projects SET frozen_at = ?, frozen_board = ?, updated_at = ? WHERE id = ?',
        args: [now, JSON.stringify(frozen), now, projectId] as (string | number | null)[],
      },
    ],
    'write'
  )

  await appendDecisionLog(projectId, actor, {
    decidedThemeId: null,
    kind: 'seeded',
    themeTitle: '',
    note: `Froze the vote and seeded ${frozen.themes.length} ${
      frozen.themes.length === 1 ? 'theme' : 'themes'
    } from the group consensus.`,
  })

  return { frozen, decided: await getDecidedThemes(projectId), alreadyFrozen: false }
}

/** Moves a decided theme to another quadrant (null = back to the unplaced tray). */
export async function moveDecidedTheme(
  projectId: string,
  decidedId: string,
  quadrantKey: QuadrantKey | null,
  actor: DecisionActor
): Promise<DecidedTheme | null> {
  const before = await getDecidedTheme(projectId, decidedId)
  if (!before) return null
  if (before.quadrantKey === quadrantKey) return before

  const now = new Date().toISOString()
  await turso.execute({
    sql: 'UPDATE quad_decided_themes SET quadrant_key = ?, updated_at = ? WHERE id = ? AND project_id = ?',
    args: [quadrantKey, now, decidedId, projectId],
  })
  await appendDecisionLog(projectId, actor, {
    decidedThemeId: decidedId,
    kind: 'moved',
    themeTitle: before.title,
    fromQuadrant: before.quadrantKey,
    toQuadrant: quadrantKey,
  })
  await touch(projectId)
  return getDecidedTheme(projectId, decidedId)
}

/** Re-scopes a decided theme: its title and/or the features inside it. */
export async function rescopeDecidedTheme(
  projectId: string,
  decidedId: string,
  data: { title: string; items: string[]; note?: string },
  actor: DecisionActor
): Promise<DecidedTheme | null> {
  const before = await getDecidedTheme(projectId, decidedId)
  if (!before) return null

  const titleChanged = before.title !== data.title
  const itemsChanged = JSON.stringify(before.items) !== JSON.stringify(data.items)
  if (!titleChanged && !itemsChanged && !data.note) return before

  const now = new Date().toISOString()
  await turso.execute({
    sql: 'UPDATE quad_decided_themes SET title = ?, items = ?, updated_at = ? WHERE id = ? AND project_id = ?',
    args: [data.title, JSON.stringify(data.items), now, decidedId, projectId],
  })

  const parts: string[] = []
  if (titleChanged) parts.push(`renamed from “${before.title}”`)
  if (itemsChanged) parts.push(`scope now ${data.items.length} ${data.items.length === 1 ? 'item' : 'items'}`)
  const auto = parts.join('; ')
  await appendDecisionLog(projectId, actor, {
    decidedThemeId: decidedId,
    kind: 'rescoped',
    themeTitle: data.title,
    note: [auto, data.note?.trim()].filter(Boolean).join(' — '),
  })
  await touch(projectId)
  return getDecidedTheme(projectId, decidedId)
}

/**
 * Adds a theme that came out of the discussion. It has no votes by definition, so
 * it never appears in the frozen board — only on the decided one, marked as added.
 * `derivedFromId` records that its scope was carved out of an existing theme.
 */
export async function addDecidedTheme(
  projectId: string,
  data: {
    title: string
    items: string[]
    quadrantKey: QuadrantKey | null
    derivedFromId?: string | null
    note?: string
  },
  actor: DecisionActor
): Promise<DecidedTheme> {
  await runMigrations()
  const existing = await getDecidedThemes(projectId)
  const derivedFrom = data.derivedFromId
    ? (existing.find((t) => t.id === data.derivedFromId) ?? null)
    : null

  const id = newId('qd')
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO quad_decided_themes
            (id, project_id, source_theme_id, title, items, quadrant_key, origin, derived_from_title, sort_order, created_at, updated_at)
          VALUES (?, ?, NULL, ?, ?, ?, 'discussion', ?, ?, ?, ?)`,
    args: [
      id,
      projectId,
      data.title,
      JSON.stringify(data.items),
      data.quadrantKey,
      derivedFrom?.title ?? null,
      existing.length,
      now,
      now,
    ],
  })
  await appendDecisionLog(projectId, actor, {
    decidedThemeId: id,
    kind: 'added',
    themeTitle: data.title,
    toQuadrant: data.quadrantKey,
    note: [derivedFrom ? `split out of “${derivedFrom.title}”` : '', data.note?.trim()]
      .filter(Boolean)
      .join(' — '),
  })
  await touch(projectId)
  return (await getDecidedTheme(projectId, id))!
}

/**
 * Drops a theme from the decided board. Only the decided row goes — the voted
 * theme and its placements are untouched, so the frozen board still shows it.
 */
export async function removeDecidedTheme(
  projectId: string,
  decidedId: string,
  actor: DecisionActor
): Promise<boolean> {
  const before = await getDecidedTheme(projectId, decidedId)
  if (!before) return false
  await turso.execute({
    sql: 'DELETE FROM quad_decided_themes WHERE id = ? AND project_id = ?',
    args: [decidedId, projectId],
  })
  await appendDecisionLog(projectId, actor, {
    decidedThemeId: null,
    kind: 'removed',
    themeTitle: before.title,
    fromQuadrant: before.quadrantKey,
    note: before.origin === 'discussion' ? 'Added in discussion, then dropped.' : 'Dropped from the decided board.',
  })
  await touch(projectId)
  return true
}

// ── Example template ─────────────────────────────────────────────────────────
// A generic, product-neutral starter set so a facilitator can see the format and
// try the flow immediately. It's meant to be edited or cleared and replaced with
// the team's own themes — not real prioritization data.
export const TEMPLATE_THEMES: Array<{ title: string; facilitatorReference: QuadrantKey | null; items: string[] }> = [
  { title: 'Onboarding & first-run', facilitatorReference: null,
    items: ['Guided setup', 'Sample/starter data', 'Progress checklist'] },
  { title: 'Search & discovery', facilitatorReference: null,
    items: ['Full-text search', 'Filters & sorting', 'Saved searches'] },
  { title: 'Collaboration', facilitatorReference: null,
    items: ['Comments & mentions', 'Sharing & permissions', 'Real-time presence'] },
  { title: 'Notifications', facilitatorReference: null,
    items: ['In-app alerts', 'Email digests', 'Per-user notification preferences'] },
  { title: 'Reporting & insights', facilitatorReference: null,
    items: ['Dashboards', 'Export to CSV', 'Scheduled reports'] },
  { title: 'Integrations', facilitatorReference: null,
    items: ['Public API', 'Webhooks', 'Third-party connectors'] },
  { title: 'Account & billing', facilitatorReference: null,
    items: ['Self-serve plans', 'Usage limits', 'Team & seat management'] },
  { title: 'Performance & reliability', facilitatorReference: null,
    items: ['Fast load times', 'Uptime & status page', 'Offline support'] },
]
