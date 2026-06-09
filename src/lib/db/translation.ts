import { randomUUID } from 'crypto'
import { turso } from './client'
import { runMigrations } from './migrations'
import type {
  TranslationProject,
  TranslationDataset,
  DatasetKind,
  UiDatasetConfig,
  CsvDatasetConfig,
} from '@/lib/translation/types'

// --- Projects --------------------------------------------------------------

function parseProject(row: Record<string, unknown>): TranslationProject {
  return {
    id: row.id as string,
    name: row.name as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function listProjects(): Promise<TranslationProject[]> {
  await runMigrations()
  const res = await turso.execute('SELECT * FROM translation_projects ORDER BY created_at ASC')
  return res.rows.map((r) => parseProject(r as Record<string, unknown>))
}

export async function getProject(id: string): Promise<TranslationProject | null> {
  await runMigrations()
  const res = await turso.execute({
    sql: 'SELECT * FROM translation_projects WHERE id = ?',
    args: [id],
  })
  return res.rows[0] ? parseProject(res.rows[0] as Record<string, unknown>) : null
}

export async function createProject(name: string): Promise<TranslationProject> {
  await runMigrations()
  const now = new Date().toISOString()
  const id = randomUUID()
  await turso.execute({
    sql: 'INSERT INTO translation_projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    args: [id, name, now, now],
  })
  return { id, name, created_at: now, updated_at: now }
}

export async function renameProject(id: string, name: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'UPDATE translation_projects SET name = ?, updated_at = ? WHERE id = ?',
    args: [name, new Date().toISOString(), id],
  })
}

export async function deleteProject(id: string): Promise<void> {
  await runMigrations()
  // Edits cascade via dataset FK; datasets cascade via project FK.
  await turso.execute({ sql: 'DELETE FROM translation_projects WHERE id = ?', args: [id] })
}

// --- Datasets --------------------------------------------------------------

function parseDataset(row: Record<string, unknown>): TranslationDataset {
  const kind = row.kind as DatasetKind
  const config = JSON.parse(row.config_json as string) as UiDatasetConfig | CsvDatasetConfig
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    kind,
    name: row.name as string,
    english_source: row.english_source as string,
    config,
    created_at: row.created_at as string,
  }
}

export async function listDatasets(projectId: string): Promise<TranslationDataset[]> {
  await runMigrations()
  const res = await turso.execute({
    sql: 'SELECT * FROM translation_datasets WHERE project_id = ? ORDER BY created_at ASC',
    args: [projectId],
  })
  return res.rows.map((r) => parseDataset(r as Record<string, unknown>))
}

export async function getDataset(id: string): Promise<TranslationDataset | null> {
  await runMigrations()
  const res = await turso.execute({
    sql: 'SELECT * FROM translation_datasets WHERE id = ?',
    args: [id],
  })
  return res.rows[0] ? parseDataset(res.rows[0] as Record<string, unknown>) : null
}

export async function createDataset(
  projectId: string,
  kind: DatasetKind,
  name: string,
  englishSource: string,
  config: UiDatasetConfig | CsvDatasetConfig,
): Promise<TranslationDataset> {
  await runMigrations()
  const now = new Date().toISOString()
  const id = randomUUID()
  await turso.execute({
    sql: 'INSERT INTO translation_datasets (id, project_id, kind, name, english_source, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, projectId, kind, name, englishSource, JSON.stringify(config), now],
  })
  // Touch the project so its updated_at reflects new sources.
  await turso.execute({
    sql: 'UPDATE translation_projects SET updated_at = ? WHERE id = ?',
    args: [now, projectId],
  })
  return { id, project_id: projectId, kind, name, english_source: englishSource, config, created_at: now }
}

export async function deleteDataset(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM translation_datasets WHERE id = ?', args: [id] })
}

// --- Edits -----------------------------------------------------------------

// All edits for a project in one language, grouped by dataset id.
export async function getEditsForLang(
  projectId: string,
  lang: string,
): Promise<Map<string, Map<string, string>>> {
  await runMigrations()
  const res = await turso.execute({
    sql: `SELECT e.dataset_id, e.entry_key, e.value
          FROM translation_edits e
          JOIN translation_datasets d ON d.id = e.dataset_id
          WHERE d.project_id = ? AND e.lang = ?`,
    args: [projectId, lang],
  })
  const out = new Map<string, Map<string, string>>()
  for (const row of res.rows) {
    const r = row as Record<string, unknown>
    const datasetId = r.dataset_id as string
    if (!out.has(datasetId)) out.set(datasetId, new Map())
    out.get(datasetId)!.set(r.entry_key as string, r.value as string)
  }
  return out
}

// Edits for a single dataset + language as entry_key -> value.
export async function getDatasetEdits(datasetId: string, lang: string): Promise<Map<string, string>> {
  await runMigrations()
  const res = await turso.execute({
    sql: 'SELECT entry_key, value FROM translation_edits WHERE dataset_id = ? AND lang = ?',
    args: [datasetId, lang],
  })
  const map = new Map<string, string>()
  for (const row of res.rows) {
    const r = row as Record<string, unknown>
    map.set(r.entry_key as string, r.value as string)
  }
  return map
}

export async function upsertEdit(
  datasetId: string,
  lang: string,
  entryKey: string,
  value: string,
  updatedBy: string | null,
): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: `INSERT INTO translation_edits (id, dataset_id, lang, entry_key, value, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(dataset_id, lang, entry_key)
          DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    args: [randomUUID(), datasetId, lang, entryKey, value, updatedBy, new Date().toISOString()],
  })
}

// Revert an entry to its originally-loaded value by dropping the edit (FR-14).
export async function deleteEdit(datasetId: string, lang: string, entryKey: string): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: 'DELETE FROM translation_edits WHERE dataset_id = ? AND lang = ? AND entry_key = ?',
    args: [datasetId, lang, entryKey],
  })
}
