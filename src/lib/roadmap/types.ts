// Shared domain types and display metadata for the Roadmap & Capacity app.
// Kept free of server-only imports so it can be used from client components too.

export interface Quarter {
  year: number
  quarter: number // 1-4
}

export interface Engineer {
  id: string
  name: string
  country: string // ISO-ish key into HOLIDAYS (e.g. 'US', 'FR', 'SG', 'UK')
  capacity_fraction: number // 1 = full engineer, 0.5 = half, etc.
  start_date: string | null // ISO date they join (null = present since the start)
  end_date: string | null // ISO date they leave (null = no end)
  active: number // 1 | 0 — a soft archive flag
  sort_order: number
}

export interface PtoEntry {
  engineer_id: string
  year: number
  quarter: number
  days: number // working days of PTO in that quarter
}

// One BAU (bugs / tech debt / maintenance) percentage per quarter. The remainder
// of gross capacity is the feature-development capacity the roadmap draws against.
export interface QuarterSetting {
  year: number
  quarter: number
  bau_pct: number // 0..1
}

export interface Initiative {
  id: string
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
  impact_kind: string | null
  owner_name: string | null
  objective: string | null
  is_bau: number
  is_required: number
  committed: number // 1 = counts against capacity as planned/committed work
  sort_order: number
}

export type InitiativeStatus = 'proposed' | 'to_do' | 'in_flight' | 'done'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type Theme =
  | 'revenue'
  | 'member_experience'
  | 'efficiency_ai_adoption'
  | 'data_systems'
  | 'supply_growth'
export type ImpactUnit = 'revenue' | 'hrs'

// ---- Display metadata -------------------------------------------------------

export const THEME_META: Record<
  string,
  { label: string; dot: string; soft: string; text: string }
> = {
  revenue: { label: 'Revenue', dot: '#1D5859', soft: '#D6E0DF', text: '#013E3F' },
  member_experience: { label: 'Member Experience', dot: '#B4791C', soft: '#FBEFC9', text: '#7A4F0A' },
  efficiency_ai_adoption: { label: 'Efficiency + AI Adoption', dot: '#5B6BA8', soft: '#E1E5F3', text: '#33407A' },
  data_systems: { label: 'Data + Systems', dot: '#7A5CA8', soft: '#EBE3F5', text: '#4A3374' },
  supply_growth: { label: 'Supply Growth', dot: '#71855A', soft: '#E4EAD9', text: '#455235' },
  _none: { label: 'Unthemed', dot: '#A8A29E', soft: '#EFECE7', text: '#57534E' },
}

export const STATUS_META: Record<InitiativeStatus, { label: string; className: string }> = {
  proposed: { label: 'Proposed', className: 'bg-canvas border border-line text-ink-muted' },
  to_do: { label: 'To do', className: 'bg-accent-wash border border-accent text-ink' },
  in_flight: { label: 'In progress', className: 'bg-pass-soft border border-pass-line text-pass' },
  done: { label: 'Done', className: 'bg-teal-100 border border-teal-300 text-teal-800' },
}

export const PRIORITY_META: Record<Priority, { label: string; rank: number; className: string }> = {
  critical: { label: 'Critical', rank: 0, className: 'text-fail' },
  high: { label: 'High', rank: 1, className: 'text-ink' },
  medium: { label: 'Medium', rank: 2, className: 'text-ink-soft' },
  low: { label: 'Low', rank: 3, className: 'text-ink-muted' },
}

export const COUNTRY_META: Record<string, { label: string; flag: string }> = {
  US: { label: 'United States', flag: '🇺🇸' },
  CA: { label: 'Canada', flag: '🇨🇦' },
  FR: { label: 'France', flag: '🇫🇷' },
  DO: { label: 'Dominican Republic', flag: '🇩🇴' },
}

// A company-wide day off (off-site, all-hands, holiday shutdown). Counts as a day
// off for every active engineer — like team-wide PTO — in the capacity model.
export interface CompanyOffDay {
  id: string
  date: string // ISO YYYY-MM-DD
  label: string
}

export function quarterKey(q: Quarter): string {
  return `${q.year}-Q${q.quarter}`
}

export function quarterLabel(q: Quarter): string {
  return `Q${q.quarter} ${q.year}`
}

// The planning window shown in the app: Q3 2026 → Q2 2027.
export const QUARTERS: Quarter[] = [
  { year: 2026, quarter: 3 },
  { year: 2026, quarter: 4 },
  { year: 2027, quarter: 1 },
  { year: 2027, quarter: 2 },
]

export const THEME_ORDER: string[] = [
  'revenue',
  'member_experience',
  'efficiency_ai_adoption',
  'data_systems',
  'supply_growth',
  '_none',
]

export function themeKey(t: string | null | undefined): string {
  return t && THEME_META[t] ? t : '_none'
}

export function formatImpact(value: number | null, unit: ImpactUnit | null): string | null {
  if (value == null || value === 0 || !unit) return null
  if (unit === 'revenue') {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
    if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
    return `$${value}`
  }
  if (unit === 'hrs') {
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K hrs`
    return `${value} hrs`
  }
  return `${value}`
}
