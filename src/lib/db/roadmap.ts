import { randomUUID } from 'crypto'
import { turso } from './client'
import { runMigrations } from './migrations'
import type {
  CompanyOffDay,
  Engineer,
  Initiative,
  InitiativeStatus,
  PtoEntry,
  Priority,
  QuarterSetting,
  Theme,
  ImpactUnit,
} from '../roadmap/types'

// Data access for the Roadmap & Capacity app (admin-only). All tables are prefixed
// `rm_`. Seeding of the Growth-team initiatives and default quarter settings happens
// in runMigrations() (idempotent), so this module is pure CRUD + reads.

// ── Row mappers ──────────────────────────────────────────────────────────────

type Row = Record<string, unknown>

function toEngineer(r: Row): Engineer {
  return {
    id: String(r.id),
    name: String(r.name),
    country: String(r.country),
    capacity_fraction: Number(r.capacity_fraction),
    start_date: (r.start_date as string | null) ?? null,
    end_date: (r.end_date as string | null) ?? null,
    active: Number(r.active),
    sort_order: Number(r.sort_order),
  }
}

function toInitiative(r: Row): Initiative {
  return {
    id: String(r.id),
    title: String(r.title),
    summary: (r.summary as string | null) ?? '',
    status: String(r.status) as InitiativeStatus,
    priority: (r.priority as Priority | null) ?? null,
    theme: (r.theme as Theme | null) ?? null,
    year: Number(r.year),
    quarter: Number(r.quarter),
    effort_weeks: r.effort_weeks == null ? null : Number(r.effort_weeks),
    impact_value: r.impact_value == null ? null : Number(r.impact_value),
    impact_unit: (r.impact_unit as ImpactUnit | null) ?? null,
    impact_revenue: r.impact_revenue == null ? null : Number(r.impact_revenue),
    impact_hours: r.impact_hours == null ? null : Number(r.impact_hours),
    impact_kind: (r.impact_kind as string | null) ?? null,
    owner_name: (r.owner_name as string | null) ?? null,
    objective: (r.objective as string | null) ?? null,
    is_bau: Number(r.is_bau),
    is_required: Number(r.is_required),
    committed: Number(r.committed),
    unscheduled: Number(r.unscheduled),
    sort_order: Number(r.sort_order),
  }
}

// ── Engineers ────────────────────────────────────────────────────────────────

export async function listEngineers(): Promise<Engineer[]> {
  await runMigrations()
  const res = await turso.execute('SELECT * FROM rm_engineers ORDER BY sort_order, name')
  return res.rows.map((r) => toEngineer(r as Row))
}

export interface EngineerInput {
  name: string
  country: string
  capacity_fraction: number
  start_date: string | null
  end_date: string | null
  active: number
}

export async function createEngineer(input: EngineerInput): Promise<Engineer> {
  await runMigrations()
  const id = randomUUID()
  const orderRes = await turso.execute('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM rm_engineers')
  const sort_order = Number((orderRes.rows[0] as Row).next)
  await turso.execute({
    sql: `INSERT INTO rm_engineers (id, name, country, capacity_fraction, start_date, end_date, active, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.name, input.country, input.capacity_fraction, input.start_date, input.end_date, input.active, sort_order],
  })
  return { id, sort_order, ...input }
}

export async function updateEngineer(id: string, input: Partial<EngineerInput>): Promise<void> {
  await runMigrations()
  const fields: string[] = []
  const args: (string | number | null)[] = []
  for (const key of ['name', 'country', 'capacity_fraction', 'start_date', 'end_date', 'active'] as const) {
    if (input[key] !== undefined) {
      fields.push(`${key} = ?`)
      args.push(input[key] as string | number | null)
    }
  }
  if (fields.length === 0) return
  args.push(id)
  await turso.execute({ sql: `UPDATE rm_engineers SET ${fields.join(', ')} WHERE id = ?`, args })
}

export async function deleteEngineer(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM rm_pto WHERE engineer_id = ?', args: [id] })
  await turso.execute({ sql: 'DELETE FROM rm_engineers WHERE id = ?', args: [id] })
}

// ── PTO ──────────────────────────────────────────────────────────────────────

export async function listPto(): Promise<PtoEntry[]> {
  await runMigrations()
  const res = await turso.execute('SELECT * FROM rm_pto')
  return res.rows.map((r) => ({
    engineer_id: String((r as Row).engineer_id),
    year: Number((r as Row).year),
    quarter: Number((r as Row).quarter),
    days: Number((r as Row).days),
  }))
}

// Upsert (or delete when days = 0) a single engineer/quarter PTO cell.
export async function setPto(entry: PtoEntry): Promise<void> {
  await runMigrations()
  if (entry.days <= 0) {
    await turso.execute({
      sql: 'DELETE FROM rm_pto WHERE engineer_id = ? AND year = ? AND quarter = ?',
      args: [entry.engineer_id, entry.year, entry.quarter],
    })
    return
  }
  await turso.execute({
    sql: `INSERT INTO rm_pto (engineer_id, year, quarter, days) VALUES (?, ?, ?, ?)
          ON CONFLICT(engineer_id, year, quarter) DO UPDATE SET days = excluded.days`,
    args: [entry.engineer_id, entry.year, entry.quarter, entry.days],
  })
}

// ── Quarter settings (BAU %) ──────────────────────────────────────────────────

export async function listSettings(): Promise<QuarterSetting[]> {
  await runMigrations()
  const res = await turso.execute('SELECT * FROM rm_settings')
  return res.rows.map((r) => ({
    year: Number((r as Row).year),
    quarter: Number((r as Row).quarter),
    bau_pct: Number((r as Row).bau_pct),
  }))
}

export async function setSetting(setting: QuarterSetting): Promise<void> {
  await runMigrations()
  await turso.execute({
    sql: `INSERT INTO rm_settings (year, quarter, bau_pct) VALUES (?, ?, ?)
          ON CONFLICT(year, quarter) DO UPDATE SET bau_pct = excluded.bau_pct`,
    args: [setting.year, setting.quarter, setting.bau_pct],
  })
}

// ── Initiatives ───────────────────────────────────────────────────────────────

export async function listInitiatives(): Promise<Initiative[]> {
  await runMigrations()
  const res = await turso.execute(
    'SELECT * FROM rm_initiatives ORDER BY year, quarter, sort_order, title'
  )
  return res.rows.map((r) => toInitiative(r as Row))
}

export interface InitiativeInput {
  title: string
  summary: string
  status: InitiativeStatus
  priority: Priority | null
  theme: Theme | null
  year: number
  quarter: number
  effort_weeks: number | null
  impact_value: number | null
  impact_unit: ImpactUnit | null
  impact_revenue: number | null
  impact_hours: number | null
  impact_kind: string | null
  owner_name: string | null
  objective: string | null
  is_bau: number
  is_required: number
  committed: number
  unscheduled: number
}

const INITIATIVE_FIELDS = [
  'title', 'summary', 'status', 'priority', 'theme', 'year', 'quarter', 'effort_weeks',
  'impact_value', 'impact_unit', 'impact_revenue', 'impact_hours', 'impact_kind', 'owner_name', 'objective',
  'is_bau', 'is_required', 'committed', 'unscheduled',
] as const

export async function createInitiative(input: InitiativeInput): Promise<Initiative> {
  await runMigrations()
  const id = randomUUID()
  const orderRes = await turso.execute('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM rm_initiatives')
  const sort_order = Number((orderRes.rows[0] as Row).next)
  await turso.execute({
    sql: `INSERT INTO rm_initiatives
            (id, ${INITIATIVE_FIELDS.join(', ')}, sort_order)
          VALUES (?, ${INITIATIVE_FIELDS.map(() => '?').join(', ')}, ?)`,
    args: [id, ...INITIATIVE_FIELDS.map((f) => input[f] as string | number | null), sort_order],
  })
  return { id, sort_order, ...input }
}

export async function updateInitiative(
  id: string,
  input: Partial<InitiativeInput> & { sort_order?: number }
): Promise<void> {
  await runMigrations()
  const fields: string[] = []
  const args: (string | number | null)[] = []
  // sort_order is server-managed on create but drag-and-drop can update it here.
  for (const key of [...INITIATIVE_FIELDS, 'sort_order'] as const) {
    const val = (input as Record<string, unknown>)[key]
    if (val !== undefined) {
      fields.push(`${key} = ?`)
      args.push(val as string | number | null)
    }
  }
  if (fields.length === 0) return
  args.push(id)
  await turso.execute({ sql: `UPDATE rm_initiatives SET ${fields.join(', ')} WHERE id = ?`, args })
}

export async function deleteInitiative(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM rm_initiatives WHERE id = ?', args: [id] })
}

// ── Company off-days ──────────────────────────────────────────────────────────

export async function listCompanyOffDays(): Promise<CompanyOffDay[]> {
  await runMigrations()
  const res = await turso.execute('SELECT * FROM rm_company_offdays ORDER BY date')
  return res.rows.map((r) => ({
    id: String((r as Row).id),
    date: String((r as Row).date),
    label: String((r as Row).label ?? ''),
  }))
}

export async function createCompanyOffDay(date: string, label: string): Promise<CompanyOffDay> {
  await runMigrations()
  const id = randomUUID()
  // A date is unique; re-adding the same day updates its label rather than erroring.
  await turso.execute({
    sql: `INSERT INTO rm_company_offdays (id, date, label) VALUES (?, ?, ?)
          ON CONFLICT(date) DO UPDATE SET label = excluded.label`,
    args: [id, date, label],
  })
  const res = await turso.execute({ sql: 'SELECT * FROM rm_company_offdays WHERE date = ?', args: [date] })
  const r = res.rows[0] as Row
  return { id: String(r.id), date: String(r.date), label: String(r.label ?? '') }
}

export async function deleteCompanyOffDay(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM rm_company_offdays WHERE id = ?', args: [id] })
}

// ── Saved scenarios ───────────────────────────────────────────────────────────
// A scenario is a named, full snapshot of the roadmap state (roster, PTO, BAU,
// initiatives, off-days) stored as an opaque JSON blob. It never affects the live
// plan or capacity math on the server — it's rehydrated client-side for what-if work.

export interface ScenarioMeta {
  id: string
  name: string
  updated_at: string
}

export interface ScenarioFull extends ScenarioMeta {
  data: unknown
}

export async function listScenarios(): Promise<ScenarioMeta[]> {
  await runMigrations()
  const res = await turso.execute('SELECT id, name, updated_at FROM rm_scenarios ORDER BY updated_at DESC')
  return res.rows.map((r) => ({
    id: String((r as Row).id),
    name: String((r as Row).name),
    updated_at: String((r as Row).updated_at),
  }))
}

export async function getScenario(id: string): Promise<ScenarioFull | null> {
  await runMigrations()
  const res = await turso.execute({ sql: 'SELECT * FROM rm_scenarios WHERE id = ?', args: [id] })
  if (res.rows.length === 0) return null
  const r = res.rows[0] as Row
  return {
    id: String(r.id),
    name: String(r.name),
    updated_at: String(r.updated_at),
    data: JSON.parse(String(r.data)),
  }
}

export async function createScenario(name: string, data: unknown): Promise<ScenarioMeta> {
  await runMigrations()
  const id = randomUUID()
  const now = new Date().toISOString()
  await turso.execute({
    sql: 'INSERT INTO rm_scenarios (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, name, JSON.stringify(data), now, now],
  })
  return { id, name, updated_at: now }
}

export async function updateScenario(
  id: string,
  patch: { name?: string; data?: unknown }
): Promise<void> {
  await runMigrations()
  const fields: string[] = []
  const args: (string | number | null)[] = []
  if (patch.name !== undefined) {
    fields.push('name = ?')
    args.push(patch.name)
  }
  if (patch.data !== undefined) {
    fields.push('data = ?')
    args.push(JSON.stringify(patch.data))
  }
  if (fields.length === 0) return
  fields.push('updated_at = ?')
  args.push(new Date().toISOString())
  args.push(id)
  await turso.execute({ sql: `UPDATE rm_scenarios SET ${fields.join(', ')} WHERE id = ?`, args })
}

export async function deleteScenario(id: string): Promise<void> {
  await runMigrations()
  await turso.execute({ sql: 'DELETE FROM rm_scenarios WHERE id = ?', args: [id] })
}

// ── Bundled load for the dashboard ─────────────────────────────────────────────

export interface RoadmapData {
  engineers: Engineer[]
  pto: PtoEntry[]
  settings: QuarterSetting[]
  initiatives: Initiative[]
  companyOffDays: CompanyOffDay[]
  scenarios: ScenarioMeta[]
}

export async function getRoadmapData(): Promise<RoadmapData> {
  await runMigrations()
  const [engineers, pto, settings, initiatives, companyOffDays, scenarios] = await Promise.all([
    listEngineers(),
    listPto(),
    listSettings(),
    listInitiatives(),
    listCompanyOffDays(),
    listScenarios(),
  ])
  return { engineers, pto, settings, initiatives, companyOffDays, scenarios }
}
