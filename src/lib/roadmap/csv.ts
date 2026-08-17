import type { Initiative } from './types'
import { BACKLOG_LABEL, PRIORITY_META, STATUS_META, THEME_META, quarterLabel, themeKey } from './types'

// Serialize the initiatives to a shareable CSV (all fields). Pure — the download
// itself happens in the client.

function esc(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const COLUMNS: { header: string; value: (i: Initiative) => string | number | null }[] = [
  { header: 'Title', value: (i) => i.title },
  { header: 'Timing', value: (i) => (i.unscheduled === 1 ? BACKLOG_LABEL : quarterLabel({ year: i.year, quarter: i.quarter })) },
  { header: 'Status', value: (i) => STATUS_META[i.status]?.label ?? i.status },
  { header: 'Priority', value: (i) => (i.priority ? PRIORITY_META[i.priority].label : '') },
  { header: 'Theme', value: (i) => (i.theme ? THEME_META[themeKey(i.theme)].label : '') },
  { header: 'Objective', value: (i) => i.objective },
  { header: 'Owner', value: (i) => i.owner_name },
  { header: 'Effort (weeks)', value: (i) => i.effort_weeks },
  { header: 'Revenue ($)', value: (i) => i.impact_revenue },
  { header: 'Hours saved', value: (i) => i.impact_hours },
  { header: 'Committed', value: (i) => (i.committed === 1 ? 'Yes' : 'No') },
  { header: 'Required', value: (i) => (i.is_required === 1 ? 'Yes' : 'No') },
  { header: 'BAU', value: (i) => (i.is_bau === 1 ? 'Yes' : 'No') },
  { header: 'Summary', value: (i) => i.summary },
]

export function initiativesToCsv(initiatives: Initiative[]): string {
  const rows = [COLUMNS.map((c) => c.header).join(',')]
  for (const i of initiatives) {
    rows.push(COLUMNS.map((c) => esc(c.value(i))).join(','))
  }
  return rows.join('\r\n')
}
