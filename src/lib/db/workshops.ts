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

/** The combined round stores rankings under this sentinel category (the schema's
 *  UNIQUE index treats NULLs as distinct, so we use '' rather than NULL). */
export const COMBINED_CATEGORY = ''

const MAX_TIE_EXPANSION = 4

export interface Workshop {
  id: string
  name: string
  description: string
  status: WorkshopStatus
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
  ordered_item_ids: string[]
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

function parseWorkshop(row: Record<string, unknown>): Workshop {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    status: (row.status as WorkshopStatus) ?? 'draft',
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
  let ordered: string[] = []
  try {
    const raw = JSON.parse((row.ordered_item_ids as string) ?? '[]')
    if (Array.isArray(raw)) ordered = raw.filter((x): x is string => typeof x === 'string')
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
    ordered_item_ids: ordered,
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
  top_n: number
  created_by: string
  created_by_name: string
}): Promise<Workshop> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO workshops (id, name, description, status, top_n, created_by, created_by_name, created_at, updated_at)
          VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
    args: [data.id, data.name, data.description, data.top_n, data.created_by, data.created_by_name, now, now],
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
  const items = await getItems(workshopId)
  const idsByCategory = new Map<string, string[]>()
  for (const it of items) {
    if (!idsByCategory.has(it.category)) idsByCategory.set(it.category, [])
    idsByCategory.get(it.category)!.push(it.id)
  }
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
 * Returns the caller's rankings for the given phase, seeding shuffled draft rows
 * on first access (one per category in round 1; one combined row in round 2).
 * The shuffle is persisted so the card order is stable across polls/refreshes.
 */
export async function getOrSeedUserRankings(
  workshopId: string,
  user: { userId: string; name: string; email: string },
  phase: WorkshopPhase
): Promise<WorkshopRanking[]> {
  const existing = await getRankingsForUserPhase(workshopId, user.userId, phase)
  const byCategory = new Map(existing.map((r) => [r.category, r]))

  let neededCategories: string[]
  if (phase === 'categories') {
    neededCategories = categoriesOf(await getItems(workshopId))
  } else {
    neededCategories = [COMBINED_CATEGORY]
  }

  const missing = neededCategories.filter((c) => !byCategory.has(c))
  if (missing.length === 0) return existing

  const now = new Date().toISOString()
  const items = await getItems(workshopId)
  const combinedIds = phase === 'combined' ? await getCombinedItemIds(workshopId) : []

  const stmts = missing.map((category) => {
    let itemIds: string[]
    if (phase === 'categories') {
      itemIds = items.filter((i) => i.category === category).map((i) => i.id)
    } else {
      itemIds = combinedIds
    }
    return {
      sql: `INSERT INTO workshop_rankings
              (id, workshop_id, user_id, user_name, user_email, phase, category, ordered_item_ids, submitted, submitted_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)
            ON CONFLICT(workshop_id, user_id, phase, category) DO NOTHING`,
      args: [
        `wr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        workshopId,
        user.userId,
        user.name,
        user.email,
        phase,
        category,
        JSON.stringify(shuffle(itemIds)),
        now,
      ] as (string | number)[],
    }
  })
  await turso.batch(stmts, 'write')
  return getRankingsForUserPhase(workshopId, user.userId, phase)
}

/** Saves one column's order (draft autosave). No-op if already submitted. */
export async function saveRankingOrder(
  workshopId: string,
  userId: string,
  phase: WorkshopPhase,
  category: string,
  orderedItemIds: string[]
): Promise<void> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `UPDATE workshop_rankings SET ordered_item_ids = ?, updated_at = ?
          WHERE workshop_id = ? AND user_id = ? AND phase = ? AND category = ? AND submitted = 0`,
    args: [JSON.stringify(orderedItemIds), now, workshopId, userId, phase, category],
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
 *   revealed          → ranking_combined  (un-submit combined rankings)
 *   ranking_combined  → ranking_categories (drop combined list + rankings, un-submit round 1)
 */
export async function reopenWorkshop(id: string): Promise<Workshop | null> {
  const workshop = await getWorkshopById(id)
  if (!workshop) return null

  if (workshop.status === 'revealed') {
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
