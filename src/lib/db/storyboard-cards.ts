import { turso } from './client'
import { runMigrations } from './migrations'
import type { InValue } from '@libsql/client'

export interface StoryboardCard {
  id: string
  storyboard_id: string
  scene_description: string
  image_url: string | null
  generation_requested_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

function parseCard(row: Record<string, unknown>): StoryboardCard {
  return {
    id: row.id as string,
    storyboard_id: row.storyboard_id as string,
    scene_description: (row.scene_description as string) ?? '',
    image_url: (row.image_url as string) ?? null,
    generation_requested_at: (row.generation_requested_at as string) ?? null,
    sort_order: (row.sort_order as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function getCardsForStoryboard(storyboardId: string): Promise<StoryboardCard[]> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM storyboard_cards WHERE storyboard_id = ? ORDER BY sort_order ASC',
    args: [storyboardId],
  })
  return result.rows.map((r) => parseCard(r as Record<string, unknown>))
}

export async function getCardById(id: string): Promise<StoryboardCard | null> {
  await runMigrations()
  const result = await turso.execute({
    sql: 'SELECT * FROM storyboard_cards WHERE id = ?',
    args: [id],
  })
  if (!result.rows[0]) return null
  return parseCard(result.rows[0] as Record<string, unknown>)
}

export async function createCard(data: {
  id: string
  storyboard_id: string
  sort_order: number
}): Promise<StoryboardCard> {
  await runMigrations()
  const now = new Date().toISOString()
  await turso.execute({
    sql: `INSERT INTO storyboard_cards (id, storyboard_id, scene_description, sort_order, created_at, updated_at)
          VALUES (?, ?, '', ?, ?, ?)`,
    args: [data.id, data.storyboard_id, data.sort_order, now, now],
  })
  return (await getCardById(data.id))!
}

export async function updateCard(
  id: string,
  data: Partial<Pick<StoryboardCard, 'scene_description' | 'sort_order' | 'image_url' | 'generation_requested_at'>>
): Promise<StoryboardCard | null> {
  await runMigrations()
  const now = new Date().toISOString()
  const sets: string[] = ['updated_at = ?']
  const args: InValue[] = [now]

  if (data.scene_description !== undefined) { sets.push('scene_description = ?'); args.push(data.scene_description) }
  if (data.sort_order !== undefined) { sets.push('sort_order = ?'); args.push(data.sort_order) }
  if (data.image_url !== undefined) { sets.push('image_url = ?'); args.push(data.image_url) }
  if (data.generation_requested_at !== undefined) { sets.push('generation_requested_at = ?'); args.push(data.generation_requested_at) }

  args.push(id)
  await turso.execute({
    sql: `UPDATE storyboard_cards SET ${sets.join(', ')} WHERE id = ?`,
    args,
  })
  return getCardById(id)
}

export async function deleteCard(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM storyboard_cards WHERE id = ?', args: [id] })
}

export async function saveImageIfLatest(
  cardId: string,
  imageUrl: string,
  expectedGenerationRequestedAt: string
): Promise<boolean> {
  await runMigrations()
  const result = await turso.execute({
    sql: `UPDATE storyboard_cards SET image_url = ?, updated_at = ?
          WHERE id = ? AND generation_requested_at = ?`,
    args: [imageUrl, new Date().toISOString(), cardId, expectedGenerationRequestedAt],
  })
  return (result.rowsAffected ?? 0) > 0
}
