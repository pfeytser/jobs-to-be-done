import { turso } from './client'
import { runMigrations } from './migrations'

// Facilitated group-prioritization workshops. An admin advances a workshop
// through four states; participants drag-rank items and submit; group results
// are aggregated with a Borda count on read.
//
//   draft → ranking_categories → ranking_combined → revealed   (+ archived)
//
// Round 1 (ranking_categories): one column per category, participants rank each.
// Advancing runs a Borda count per category, freezes the top-N items into a
// single merged list. Round 2 (ranking_combined): participants rank that list.
// Reveal shows the aggregate combined ranking plus each per-category aggregate.

export type WorkshopStatus =
  | 'draft'
  | 'ranking_categories'
  | 'ranking_combined'
  | 'revealed'
  | 'archived'

export type WorkshopPhase = 'categories' | 'combined'

/** Single-ranking (today's flow) vs the Stickiness × Differentiation matrix mode. */
export type WorkshopMode = 'single' | 'multi'

/** A dimension is either a forced-rank ordering or a per-item labelled choice. */
export type DimensionType = 'rank' | 'choice'

export interface ChoiceOption {
  key: string
  label: string
  /** Ordinal used to place items on the matrix axis and average across voters. */
  value: number
}

export interface Dimension {
  key: string
  name: string
  description: string
  type: DimensionType
  /** Present for `choice` dimensions only. */
  options?: ChoiceOption[]
}

/** The three fixed Differentiation buckets, low → high. (Keys are stable
 *  internal ids — only the labels are surfaced to participants.) */
export const DIFFERENTIATION_OPTIONS: ChoiceOption[] = [
  { key: 'not_necessary', label: 'Would be nice', value: 0 },
  { key: 'table_stakes', label: 'Table stakes', value: 1 },
  { key: 'differentiator', label: 'Makes it Indy', value: 2 },
]

/** The two axes of multi mode. The server always builds a workshop's dimensions
 *  from this template (only name/description are caller-editable) so no arbitrary
 *  type/options can be injected. */
export const DEFAULT_DIMENSIONS: Dimension[] = [
  { key: 'stickiness', name: 'Stickiness', description: 'Would people miss it if it disappeared?', type: 'rank' },
  {
    key: 'differentiation',
    name: 'Differentiation',
    description: 'Does this make us meaningfully different?',
    type: 'choice',
    options: DIFFERENTIATION_OPTIONS,
  },
]

/** The combined round stores rankings under this sentinel category (the schema's
 *  UNIQUE index treats NULLs as distinct, so we use '' rather than NULL). */
export const COMBINED_CATEGORY = ''

const MAX_TIE_EXPANSION = 4

export interface Workshop {
  id: string
  name: string
  description: string
  status: WorkshopStatus
  mode: WorkshopMode
  dimensions: Dimension[]
  top_n: number
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
  activated_at: string | null
  combined_at: string | null
  revealed_at: string | null
  archived_at: string | null
}

export interface WorkshopItem {
  id: string
  workshop_id: string
  category: string
  title: string
  description: string
  sort_order: number
  created_at: string
}

export interface WorkshopRanking {
  id: string
  workshop_id: string
  user_id: string
  user_name: string
  user_email: string
  phase: WorkshopPhase
  category: string
  dimension: string
  /** Populated for `rank` dimensions (the ordered item ids). */
  ordered_item_ids: string[]
  /** Populated for `choice` dimensions: item id → chosen option key. */
  choices: Record<string, string>
  submitted: boolean
  submitted_at: string | null
  updated_at: string
}

/** An aggregated result row: one item with its Borda score and finishing rank. */
export interface RankedItem {
  item: WorkshopItem
  score: number
  rank: number
}

function parseDimensions(raw: unknown): Dimension[] {
  if (typeof raw !== 'string' || raw === '') return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === 'object')
      .map((d) => ({
        key: String(d.key ?? ''),
        name: String(d.name ?? ''),
        description: String(d.description ?? ''),
        type: (d.type === 'choice' ? 'choice' : 'rank') as DimensionType,
        options: Array.isArray(d.options)
          ? (d.options as Record<string, unknown>[]).map((o) => ({
              key: String(o.key ?? ''),
              label: String(o.label ?? ''),
              value: Number(o.value ?? 0),
            }))
          : undefined,
      }))
      .filter((d) => d.key !== '')
  } catch {
    return []
  }
}

function parseWorkshop(row: Record<string, unknown>): Workshop {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    status: (row.status as WorkshopStatus) ?? 'draft',
    mode: (row.mode as WorkshopMode) ?? 'single',
    dimensions: parseDimensions(row.dimensions),
    top_n: Number(row.top_n ?? 2),
    created_by: row.created_by as string,
    created_by_name: (row.created_by_name as string) ?? '',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    activated_at: (row.activated_at as string) ?? null,
    combined_at: (row.combined_at as string) ?? null,
    revealed_at: (row.revealed_at as string) ?? null,
    archived_at: (row.archived_at as string) ?? null,
  }
}

function parseItem(row: Record<string, unknown>): WorkshopItem {
  return {
    id: row.id as string,
    workshop_id: row.workshop_id as string,
    category: (row.category as string) ?? '',
    title: (row.title as string) ?? '',
    description: (row.description as string) ?? '',
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at as string,
  }
}

function parseRanking(row: Record<string, unknown>): WorkshopRanking {
  // The JSON column holds an array for `rank` dimensions and an object
  // (item id → option key) for `choice` dimensions; branch on the parsed shape.
  let ordered: string[] = []
  let choices: Record<string, string> = {}
  try {
    const raw = JSON.parse((row.ordered_item_ids as string) ?? '[]')
    if (Array.isArray(raw)) {
      ordered = raw.filter((x): x is string => typeof x === 'string')
    } else if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'string') choices[k] = v
      }
    }
  } catch {
    ordered = []
  }
  return {
    id: row.id as string,
    workshop_id: row.workshop_id as string,
    user_id: row.user_id as string,
    user_name: (row.user_name as string) ?? '',
    user_email: (row.user_email as string) ?? '',
    phase: (row.phase as WorkshopPhase) ?? 'categories',
    category: (row.category as string) ?? '',
    dimension: (row.dimension as string) ?? '',
    ordered_item_ids: ordered,
    choices,
    submitted: Boolean(row.submitted),
    submitted_at: (row.submitted_at as string) ?? null,
    updated_at: row.updated_at as string,
  }
}

// ── Workshops ────────────────────────────────────────────────────────────────

export async function getWorkshopById(id: string): Promise<Workshop | null> {
  await runMigrations()
  const result = await turso.execute({ sql: 'SELECT * FROM workshops WHERE id = ?', args: [id] })
  if (!result.rows[0]) return null
  return parseWorkshop(result.rows[0] as Record<string, unknown>)
}

export async function getAllWorkshops(): Promise<Workshop[]> {
  await runMigrations()
  const result = await turso.execute('SELECT * FROM workshops ORDER BY created_at DESC')
  return result.rows.map((r) => parseWorkshop(r as Record<string, unknown>))
}

/** Workshops a participant may see: everything past draft, except archived. */
export async function getVisibleWorkshops(): Promise<Workshop[]> {
  await runMigrations()
  const result = await turso.execute(
    "SELECT * FROM workshops WHERE status IN ('ranking_categories', 'ranking_combined', 'revealed') ORDER BY created_at DESC"
  )
  return result.rows.map((r) => parseWorkshop(r as Record<string, unknown>))
}

export async function getWorkshopsCreatedBy(userId: string): Promise<Workshop[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM workshops WHERE created_by = ? ORDER BY created_at DESC',
    args: [userId],
  })
  return result.rows.map((r) => parseWorkshop(r as Record<string, unknown>))
}

export async function createWorkshop(data: {
  id: string
  name: string
  description: string
  mode: WorkshopMode
  dimensions: Dimension[]
  top_n: number
  created_by: string
  created_by_name: string
}): Promise<Workshop> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO workshops (id, name, description, status, mode, dimensions, top_n, created_by, created_by_name, created_at, updated_at)
          VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.id,
      data.name,
      data.description,
      data.mode,
      JSON.stringify(data.dimensions),
      data.top_n,
      data.created_by,
      data.created_by_name,
      now,
      now,
    ],
  })
  return (await getWorkshopById(data.id))!
}

export async function deleteWorkshop(id: string): Promise<void> {
  await runMigrations()
  // Children are ON DELETE CASCADE, but delete explicitly in case FKs are off.
  await turso.batch(
    [
      { sql: 'DELETE FROM workshop_rankings WHERE workshop_id = ?', args: [id] },
      { sql: 'DELETE FROM workshop_combined_items WHERE workshop_id = ?', args: [id] },
      { sql: 'DELETE FROM workshop_items WHERE workshop_id = ?', args: [id] },
      { sql: 'DELETE FROM workshops WHERE id = ?', args: [id] },
    ],
    'write'
  )
}

async function touch(id: string, extraSets: string[] = [], extraArgs: (string | number)[] = []) {
  const now = new Date().toISOString()
  const sets = ['updated_at = ?', ...extraSets]
  const args: (string | number)[] = [now, ...extraArgs, id]
  await turso.execute({ sql: `UPDATE workshops SET ${sets.join(', ')} WHERE id = ?`, args })
}

// ── Items ────────────────────────────────────────────────────────────────────

export async function getItems(workshopId: string): Promise<WorkshopItem[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM workshop_items WHERE workshop_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [workshopId],
  })
  return result.rows.map((r) => parseItem(r as Record<string, unknown>))
}

export async function getItemsByIds(workshopId: string, ids: string[]): Promise<WorkshopItem[]> {
  if (ids.length === 0) return []
  const all = await getItems(workshopId)
  const set = new Set(ids)
  return all.filter((i) => set.has(i.id))
}

export async function updateItem(
  workshopId: string,
  itemId: string,
  data: { category: string; title: string; description: string }
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE workshop_items SET category = ?, title = ?, description = ? WHERE id = ? AND workshop_id = ?',
    args: [data.category, data.title, data.description, itemId, workshopId],
  })
  await touch(workshopId)
}

export async function deleteItem(workshopId: string, itemId: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'DELETE FROM workshop_items WHERE id = ? AND workshop_id = ?',
    args: [itemId, workshopId],
  })
  await touch(workshopId)
}

/** Category names in stable insertion order. */
export function categoriesOf(items: WorkshopItem[]): string[] {
  const seen: string[] = []
  for (const it of items) if (!seen.includes(it.category)) seen.push(it.category)
  return seen
}

/**
 * The dimensions a workshop ranks along. Single mode collapses to one implicit
 * `rank` dimension with an empty key, so every downstream code path (seeding,
 * validation, aggregation) can treat both modes uniformly.
 */
export function dimensionsFor(workshop: Workshop): Dimension[] {
  if (workshop.mode === 'multi' && workshop.dimensions.length > 0) return workshop.dimensions
  return [{ key: '', name: '', description: '', type: 'rank' }]
}

/** Every (category, dimension) row a participant must fill for the given phase. */
export function rankingKeysFor(
  workshop: Workshop,
  phase: WorkshopPhase,
  categories: string[]
): Array<{ category: string; dimension: string }> {
  if (phase === 'combined') return [{ category: COMBINED_CATEGORY, dimension: '' }]
  const keys: Array<{ category: string; dimension: string }> = []
  for (const category of categories) {
    for (const dim of dimensionsFor(workshop)) keys.push({ category, dimension: dim.key })
  }
  return keys
}

/**
 * Reconciles the item set to `desired`, preserving the ids of items that carry
 * one (so existing rankings stay valid) while inserting/deleting the rest.
 * Returns whether the change was *structural* — an item added, removed, or moved
 * to a different category — as opposed to a text-only edit (title/description),
 * which leaves every ranking untouched.
 */
export async function syncItems(
  workshopId: string,
  desired: Array<{ id?: string; category: string; title: string; description: string }>
): Promise<{ items: WorkshopItem[]; structural: boolean }> {
  await runMigrations()
  const now = new Date().toISOString()
  const existing = await getItems(workshopId)
  const existingById = new Map(existing.map((i) => [i.id, i]))

  const keptIds = new Set<string>()
  const stmts: { sql: string; args: (string | number)[] }[] = []
  let structural = false

  desired.forEach((d, i) => {
    const prior = d.id ? existingById.get(d.id) : undefined
    if (prior) {
      keptIds.add(prior.id)
      if (prior.category !== d.category) structural = true
      stmts.push({
        sql: 'UPDATE workshop_items SET category = ?, title = ?, description = ?, sort_order = ? WHERE id = ? AND workshop_id = ?',
        args: [d.category, d.title, d.description, i, prior.id, workshopId],
      })
    } else {
      structural = true
      stmts.push({
        sql: `INSERT INTO workshop_items (id, workshop_id, category, title, description, sort_order, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `wi_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          workshopId,
          d.category,
          d.title,
          d.description,
          i,
          now,
        ],
      })
    }
  })

  for (const item of existing) {
    if (!keptIds.has(item.id)) {
      structural = true
      stmts.push({ sql: 'DELETE FROM workshop_items WHERE id = ? AND workshop_id = ?', args: [item.id, workshopId] })
    }
  }

  await turso.batch(stmts, 'write')
  await touch(workshopId)
  return { items: await getItems(workshopId), structural }
}

/**
 * Patches every round-1 ranking so each user's per-category order matches the
 * current items: kept in their chosen order, newly-added items appended, removed
 * items dropped. Call after a structural edit while the category round is live.
 */
export async function reconcileCategoryRankings(workshopId: string): Promise<void> {
  await runMigrations()
  const workshop = await getWorkshopById(workshopId)
  if (!workshop) return
  const items = await getItems(workshopId)
  const idsByCategory = new Map<string, string[]>()
  for (const it of items) {
    if (!idsByCategory.has(it.category)) idsByCategory.set(it.category, [])
    idsByCategory.get(it.category)!.push(it.id)
  }
  const choiceDims = new Set(dimensionsFor(workshop).filter((d) => d.type === 'choice').map((d) => d.key))
  const result = await turso.execute({
    sql: "SELECT * FROM workshop_rankings WHERE workshop_id = ? AND phase = 'categories'",
    args: [workshopId],
  })
  const now = new Date().toISOString()
  const stmts: { sql: string; args: (string | number)[] }[] = []
  for (const r of result.rows) {
    const row = parseRanking(r as Record<string, unknown>)
    const valid = idsByCategory.get(row.category) ?? []
    const validSet = new Set(valid)

    if (choiceDims.has(row.dimension)) {
      // Choice row: keep assignments for surviving items, drop removed ones.
      // New items are simply left unassigned (submit will require them).
      const kept: Record<string, string> = {}
      for (const [id, opt] of Object.entries(row.choices)) if (validSet.has(id)) kept[id] = opt
      const changed = Object.keys(kept).length !== Object.keys(row.choices).length
      if (changed) {
        stmts.push({
          sql: 'UPDATE workshop_rankings SET ordered_item_ids = ?, updated_at = ? WHERE id = ?',
          args: [JSON.stringify(kept), now, row.id],
        })
      }
      continue
    }

    const kept = row.ordered_item_ids.filter((id) => validSet.has(id))
    const appended = valid.filter((id) => !kept.includes(id))
    const next = [...kept, ...appended]
    const changed =
      next.length !== row.ordered_item_ids.length || next.some((id, i) => id !== row.ordered_item_ids[i])
    if (changed) {
      stmts.push({
        sql: 'UPDATE workshop_rankings SET ordered_item_ids = ?, updated_at = ? WHERE id = ?',
        args: [JSON.stringify(next), now, row.id],
      })
    }
  }
  if (stmts.length) await turso.batch(stmts, 'write')
}

/** Un-submits everyone in a phase so they re-confirm after a structural change. */
export async function resetPhaseSubmissions(workshopId: string, phase: WorkshopPhase): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE workshop_rankings SET submitted = 0, submitted_at = NULL WHERE workshop_id = ? AND phase = ?',
    args: [workshopId, phase],
  })
}

// ── Combined set (frozen top-N for round 2) ─────────────────────────────────

export async function getCombinedItemIds(workshopId: string): Promise<string[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT item_id FROM workshop_combined_items WHERE workshop_id = ? ORDER BY sort_order ASC',
    args: [workshopId],
  })
  return result.rows.map((r) => (r as Record<string, unknown>).item_id as string)
}

async function setCombinedItems(workshopId: string, itemIds: string[]): Promise<void> {
  const stmts = [
    { sql: 'DELETE FROM workshop_combined_items WHERE workshop_id = ?', args: [workshopId] as (string | number)[] },
  ]
  itemIds.forEach((itemId, i) => {
    stmts.push({
      sql: 'INSERT INTO workshop_combined_items (workshop_id, item_id, sort_order) VALUES (?, ?, ?)',
      args: [workshopId, itemId, i],
    })
  })
  await turso.batch(stmts, 'write')
}

// ── Rankings ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function getRankingsForUserPhase(
  workshopId: string,
  userId: string,
  phase: WorkshopPhase
): Promise<WorkshopRanking[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM workshop_rankings WHERE workshop_id = ? AND user_id = ? AND phase = ?',
    args: [workshopId, userId, phase],
  })
  return result.rows.map((r) => parseRanking(r as Record<string, unknown>))
}

async function getSubmittedRankings(
  workshopId: string,
  phase: WorkshopPhase
): Promise<WorkshopRanking[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM workshop_rankings WHERE workshop_id = ? AND phase = ? AND submitted = 1',
    args: [workshopId, phase],
  })
  return result.rows.map((r) => parseRanking(r as Record<string, unknown>))
}

/**
 * Returns the caller's rankings for the given phase, seeding draft rows on first
 * access — one per (category × dimension) in round 1, one combined row in round 2.
 * `rank` dimensions seed a persisted shuffle (stable card order across polls);
 * `choice` dimensions seed an empty assignment map. The dimension key is '' in
 * single mode / the combined round, so behaviour there is unchanged.
 */
export async function getOrSeedUserRankings(
  workshopId: string,
  user: { userId: string; name: string; email: string },
  phase: WorkshopPhase
): Promise<WorkshopRanking[]> {
  const workshop = await getWorkshopById(workshopId)
  if (!workshop) return []

  const existing = await getRankingsForUserPhase(workshopId, user.userId, phase)
  const seen = new Set(existing.map((r) => `${r.category} ${r.dimension}`))

  const items = await getItems(workshopId)
  const categories = phase === 'categories' ? categoriesOf(items) : [COMBINED_CATEGORY]
  const keys = rankingKeysFor(workshop, phase, categories)
  const dimByKey = new Map(dimensionsFor(workshop).map((d) => [d.key, d]))
  const combinedIds = phase === 'combined' ? await getCombinedItemIds(workshopId) : []

  const missing = keys.filter((k) => !seen.has(`${k.category} ${k.dimension}`))
  if (missing.length === 0) return existing

  const now = new Date().toISOString()
  const stmts = missing.map((key, i) => {
    const dim = dimByKey.get(key.dimension)
    const isChoice = dim?.type === 'choice'
    const itemIds =
      phase === 'combined'
        ? combinedIds
        : items.filter((it) => it.category === key.category).map((it) => it.id)
    // rank → shuffled id array; choice → empty {itemId: option} map.
    const payload = isChoice ? '{}' : JSON.stringify(shuffle(itemIds))
    return {
      sql: `INSERT INTO workshop_rankings
              (id, workshop_id, user_id, user_name, user_email, phase, category, dimension, ordered_item_ids, submitted, submitted_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)
            ON CONFLICT(workshop_id, user_id, phase, category, dimension) DO NOTHING`,
      args: [
        `wr_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        workshopId,
        user.userId,
        user.name,
        user.email,
        phase,
        key.category,
        key.dimension,
        payload,
        now,
      ] as (string | number)[],
    }
  })
  await turso.batch(stmts, 'write')
  return getRankingsForUserPhase(workshopId, user.userId, phase)
}

/**
 * Saves one (category, dimension) cell's draft state — a serialized id array for
 * `rank` dimensions or a `{itemId: optionKey}` map for `choice`. No-op once submitted.
 */
export async function saveRanking(
  workshopId: string,
  userId: string,
  phase: WorkshopPhase,
  category: string,
  dimension: string,
  payload: string[] | Record<string, string>
): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `UPDATE workshop_rankings SET ordered_item_ids = ?, updated_at = ?
          WHERE workshop_id = ? AND user_id = ? AND phase = ? AND category = ? AND dimension = ? AND submitted = 0`,
    args: [JSON.stringify(payload), now, workshopId, userId, phase, category, dimension],
  })
}

/** Marks every one of a user's rows in the phase as submitted. */
export async function submitRankings(
  workshopId: string,
  userId: string,
  phase: WorkshopPhase
): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `UPDATE workshop_rankings SET submitted = 1, submitted_at = ?, updated_at = ?
          WHERE workshop_id = ? AND user_id = ? AND phase = ?`,
    args: [now, now, workshopId, userId, phase],
  })
}

/** Reverts a user's own submission for the phase so they can edit and re-submit. */
export async function unsubmitRankings(
  workshopId: string,
  userId: string,
  phase: WorkshopPhase
): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `UPDATE workshop_rankings SET submitted = 0, submitted_at = NULL, updated_at = ?
          WHERE workshop_id = ? AND user_id = ? AND phase = ?`,
    args: [now, workshopId, userId, phase],
  })
}

export interface SubmissionStats {
  participantCount: number
  submittedCount: number
  submittedNames: string[]
  pendingNames: string[]
}

/** Progress for the waiting room: who has started vs. submitted, this phase. */
export async function getSubmissionStats(
  workshopId: string,
  phase: WorkshopPhase
): Promise<SubmissionStats> {
  await runMigrations()
  const result = await turso.execute({
    sql: `SELECT user_id, user_name, MAX(submitted) AS any_submitted
          FROM workshop_rankings WHERE workshop_id = ? AND phase = ?
          GROUP BY user_id`,
    args: [workshopId, phase],
  })
  const submittedNames: string[] = []
  const pendingNames: string[] = []
  for (const r of result.rows) {
    const row = r as Record<string, unknown>
    const name = (row.user_name as string) || 'Someone'
    if (Number(row.any_submitted) === 1) submittedNames.push(name)
    else pendingNames.push(name)
  }
  return {
    participantCount: result.rows.length,
    submittedCount: submittedNames.length,
    submittedNames,
    pendingNames,
  }
}

// ── Borda aggregation ────────────────────────────────────────────────────────

/**
 * Borda count over a set of submitted orderings that all rank the same items.
 * In a list of length N, the user's #1 earns N points … #N earns 1. Points are
 * summed across submitted rankings and returned sorted by score (desc), with
 * ties broken by the item's own sort order for stability.
 */
function bordaRank(
  rankings: WorkshopRanking[],
  candidateItems: WorkshopItem[]
): RankedItem[] {
  const scores = new Map<string, number>()
  for (const item of candidateItems) scores.set(item.id, 0)

  for (const r of rankings) {
    // Only score ids that are genuine candidates (guards against stale ids).
    const ids = r.ordered_item_ids.filter((id) => scores.has(id))
    const n = ids.length
    ids.forEach((id, idx) => {
      scores.set(id, (scores.get(id) ?? 0) + (n - idx))
    })
  }

  const orderIndex = new Map(candidateItems.map((it, i) => [it.id, i]))
  const ranked = candidateItems
    .map((item) => ({ item, score: scores.get(item.id) ?? 0 }))
    .sort((a, b) => b.score - a.score || (orderIndex.get(a.item.id)! - orderIndex.get(b.item.id)!))

  return ranked.map((r, i) => ({ item: r.item, score: r.score, rank: i + 1 }))
}

/** Top-N with tie expansion at the cutoff (capped at MAX_TIE_EXPANSION). */
function selectTop(ranked: RankedItem[], topN: number): RankedItem[] {
  if (ranked.length <= topN) return ranked
  const cutoff = ranked[topN - 1].score
  const selected = ranked.filter((r) => r.score >= cutoff)
  return selected.slice(0, MAX_TIE_EXPANSION)
}

/** Per-category aggregate ranking from round 1's submitted orderings. */
export async function getCategoryResults(
  workshopId: string
): Promise<Array<{ category: string; ranked: RankedItem[] }>> {
  const items = await getItems(workshopId)
  const submitted = await getSubmittedRankings(workshopId, 'categories')
  return categoriesOf(items).map((category) => {
    const candidates = items.filter((i) => i.category === category)
    const rankings = submitted.filter((r) => r.category === category)
    return { category, ranked: bordaRank(rankings, candidates) }
  })
}

/** Aggregate ranking of the merged list from round 2's submitted orderings. */
export async function getCombinedResults(workshopId: string): Promise<RankedItem[]> {
  const combinedIds = await getCombinedItemIds(workshopId)
  const candidates = await getItemsByIds(workshopId, combinedIds)
  // Preserve the frozen combined order for stable tie-breaks.
  const orderMap = new Map(combinedIds.map((id, i) => [id, i]))
  candidates.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
  const submitted = await getSubmittedRankings(workshopId, 'combined')
  return bordaRank(submitted, candidates)
}

// ── Multi-dimension (matrix) aggregation ───────────────────────────────────────

/** One item's position on the Stickiness × Differentiation matrix. */
export interface MatrixItemResult {
  item: WorkshopItem
  /** Stickiness (rank dimension): finishing rank (1 = most sticky) + Borda score. */
  stickinessRank: number
  stickinessScore: number
  /** Number of participants who ranked this category (rank dimension). */
  rankVotes: number
  /** Differentiation (choice dimension): mean option value, or null if unvoted. */
  diffMean: number | null
  /** The option key nearest the mean (the item's group differentiation bucket). */
  diffLabel: string | null
  /** Per-option tally (option key → votes). */
  diffCounts: Record<string, number>
  diffVotes: number
}

export interface CategoryMatrixResult {
  category: string
  items: MatrixItemResult[]
}

export interface DimensionResults {
  rankDimension: Dimension | null
  choiceDimension: Dimension | null
  categories: CategoryMatrixResult[]
}

/**
 * Aggregates the multi-mode round for the reveal matrix. For each category:
 *  - the rank dimension is Borda-counted (stickiness axis), and
 *  - the choice dimension is averaged per item (differentiation axis): each
 *    participant's option value is meaned, and the nearest option is the item's
 *    group bucket. Both axes use only submitted rows.
 */
export async function getDimensionResults(workshopId: string): Promise<DimensionResults> {
  const workshop = await getWorkshopById(workshopId)
  if (!workshop) return { rankDimension: null, choiceDimension: null, categories: [] }

  const dims = dimensionsFor(workshop)
  const rankDim = dims.find((d) => d.type === 'rank') ?? null
  const choiceDim = dims.find((d) => d.type === 'choice') ?? null
  const optionValue = new Map((choiceDim?.options ?? []).map((o) => [o.key, o.value]))

  const items = await getItems(workshopId)
  const submitted = await getSubmittedRankings(workshopId, 'categories')

  const categories = categoriesOf(items).map((category) => {
    const candidates = items.filter((i) => i.category === category)

    // Stickiness — Borda over the rank dimension's submitted rows.
    const rankRows = rankDim
      ? submitted.filter((r) => r.category === category && r.dimension === rankDim.key)
      : []
    const ranked = bordaRank(rankRows, candidates)
    const rankByItem = new Map(ranked.map((r) => [r.item.id, r]))

    // Differentiation — average the chosen option values per item.
    const choiceRows = choiceDim
      ? submitted.filter((r) => r.category === category && r.dimension === choiceDim.key)
      : []

    const resultItems: MatrixItemResult[] = candidates.map((item) => {
      const rk = rankByItem.get(item.id)

      const counts: Record<string, number> = {}
      let sum = 0
      let votes = 0
      for (const row of choiceRows) {
        const opt = row.choices[item.id]
        if (opt && optionValue.has(opt)) {
          counts[opt] = (counts[opt] ?? 0) + 1
          sum += optionValue.get(opt)!
          votes += 1
        }
      }
      const mean = votes > 0 ? sum / votes : null

      // Nearest option to the mean; ties resolve to the higher value.
      let diffLabel: string | null = null
      if (mean !== null && choiceDim?.options?.length) {
        let best = choiceDim.options[0]
        for (const o of choiceDim.options) {
          const d = Math.abs(o.value - mean)
          const bd = Math.abs(best.value - mean)
          if (d < bd || (d === bd && o.value > best.value)) best = o
        }
        diffLabel = best.key
      }

      return {
        item,
        stickinessRank: rk?.rank ?? 0,
        stickinessScore: rk?.score ?? 0,
        rankVotes: rankRows.length,
        diffMean: mean,
        diffLabel,
        diffCounts: counts,
        diffVotes: votes,
      }
    })

    return { category, items: resultItems }
  })

  return { rankDimension: rankDim, choiceDimension: choiceDim, categories }
}

// ── State transitions ────────────────────────────────────────────────────────

export async function activateWorkshop(id: string): Promise<Workshop | null> {
  await touch(id, ["status = 'ranking_categories'", 'activated_at = ?'], [new Date().toISOString()])
  return getWorkshopById(id)
}

/**
 * Round 1 → round 2. Borda-counts each category, freezes the top-N (with tie
 * expansion) into the combined list, then flips status.
 */
export async function advanceToCombined(id: string): Promise<Workshop | null> {
  const workshop = await getWorkshopById(id)
  if (!workshop) return null
  const categoryResults = await getCategoryResults(id)
  const selectedIds: string[] = []
  for (const { ranked } of categoryResults) {
    for (const r of selectTop(ranked, workshop.top_n)) selectedIds.push(r.item.id)
  }
  await setCombinedItems(id, selectedIds)
  await touch(id, ["status = 'ranking_combined'", 'combined_at = ?'], [new Date().toISOString()])
  return getWorkshopById(id)
}

export async function revealWorkshop(id: string): Promise<Workshop | null> {
  await touch(id, ["status = 'revealed'", 'revealed_at = ?'], [new Date().toISOString()])
  return getWorkshopById(id)
}

export async function archiveWorkshop(id: string): Promise<Workshop | null> {
  await touch(id, ["status = 'archived'", 'archived_at = ?'], [new Date().toISOString()])
  return getWorkshopById(id)
}

export async function unarchiveWorkshop(id: string): Promise<Workshop | null> {
  await touch(id, ["status = 'revealed'", 'archived_at = NULL'])
  return getWorkshopById(id)
}

/**
 * Steps a workshop back one phase so participants can redo the current round.
 *   revealed (single) → ranking_combined   (un-submit combined rankings)
 *   revealed (multi)  → ranking_categories (un-submit round 1 — no combined round)
 *   ranking_combined  → ranking_categories (drop combined list + rankings, un-submit round 1)
 */
export async function reopenWorkshop(id: string): Promise<Workshop | null> {
  const workshop = await getWorkshopById(id)
  if (!workshop) return null

  if (workshop.status === 'revealed') {
    if (workshop.mode === 'multi') {
      await turso.execute({
        sql: "UPDATE workshop_rankings SET submitted = 0, submitted_at = NULL WHERE workshop_id = ? AND phase = 'categories'",
        args: [id],
      })
      await touch(id, ["status = 'ranking_categories'", 'revealed_at = NULL'])
      return getWorkshopById(id)
    }
    await turso.execute({
      sql: "UPDATE workshop_rankings SET submitted = 0, submitted_at = NULL WHERE workshop_id = ? AND phase = 'combined'",
      args: [id],
    })
    await touch(id, ["status = 'ranking_combined'", 'revealed_at = NULL'])
    return getWorkshopById(id)
  }

  if (workshop.status === 'ranking_combined') {
    await turso.batch(
      [
        { sql: "DELETE FROM workshop_rankings WHERE workshop_id = ? AND phase = 'combined'", args: [id] },
        { sql: 'DELETE FROM workshop_combined_items WHERE workshop_id = ?', args: [id] },
        { sql: "UPDATE workshop_rankings SET submitted = 0, submitted_at = NULL WHERE workshop_id = ? AND phase = 'categories'", args: [id] },
      ],
      'write'
    )
    await touch(id, ["status = 'ranking_categories'", 'combined_at = NULL'])
    return getWorkshopById(id)
  }

  return workshop
}

/** Maps a live status to its active ranking phase (null outside the two rounds). */
export function phaseForStatus(status: WorkshopStatus): WorkshopPhase | null {
  if (status === 'ranking_categories') return 'categories'
  if (status === 'ranking_combined') return 'combined'
  return null
}
