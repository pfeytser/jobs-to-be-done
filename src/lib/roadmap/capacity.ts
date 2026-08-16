// Pure engineering-capacity model. No server imports — runs identically on the
// server (for the initial render) and in the browser (for instant "what-if"
// recomputation as the admin drags sliders and edits the roster).
//
// The model, per engineer per quarter:
//   workingDays   = weekdays (Mon–Fri) inside the engineer's active window ∩ quarter
//   holidayDays   = weekday public holidays for the engineer's country in that window
//   ptoDays       = booked PTO days for that engineer/quarter (bounded to what's left)
//   effectiveDays = max(0, workingDays − holidayDays − ptoDays)
//   engineerWeeks = (effectiveDays / 5) × capacity_fraction
// Summed across engineers → grossWeeks. Feature capacity = grossWeeks × (1 − bau_pct).

import type { Engineer, Initiative, PtoEntry, Quarter, QuarterSetting } from './types'
import { quarterKey } from './types'
import { holidaysForCountry } from './holidays'

export interface QuarterCapacity {
  year: number
  quarter: number
  grossWeeks: number // total available engineering weeks after holidays/PTO
  bauPct: number
  bauWeeks: number // weeks reserved for bugs / tech debt / maintenance
  featureWeeks: number // capacity available for new feature development
  committedWeeks: number // effort of committed initiatives landing this quarter
  plannedWeeks: number // effort of all (committed + proposed) initiatives this quarter
  headroomWeeks: number // featureWeeks − committedWeeks (can be negative = over capacity)
  utilizationPct: number // committedWeeks / featureWeeks
  engineerCount: number // headcount contributing (fractional-aware)
  perEngineer: EngineerQuarterCapacity[]
}

export interface EngineerQuarterCapacity {
  engineerId: string
  name: string
  workingDays: number
  holidayDays: number
  ptoDays: number
  effectiveWeeks: number
}

function toUTCDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function quarterRange(q: Quarter): { start: Date; end: Date } {
  const startMonth = (q.quarter - 1) * 3
  const start = new Date(Date.UTC(q.year, startMonth, 1))
  const end = new Date(Date.UTC(q.year, startMonth + 3, 0)) // last day of the quarter
  return { start, end }
}

function isWeekday(d: Date): boolean {
  const day = d.getUTCDay()
  return day !== 0 && day !== 6
}

// Count weekdays in [start, end] inclusive.
function countWeekdays(start: Date, end: Date): number {
  if (end < start) return 0
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    if (isWeekday(cur)) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b
}
function minDate(a: Date, b: Date): Date {
  return a < b ? a : b
}

const DAYS_PER_WEEK = 5

export function computeEngineerQuarter(
  engineer: Engineer,
  q: Quarter,
  ptoDays: number
): EngineerQuarterCapacity {
  const { start: qStart, end: qEnd } = quarterRange(q)

  // Active window: intersect the engineer's [start, end] with the quarter.
  const eStart = engineer.start_date ? toUTCDate(engineer.start_date) : qStart
  const eEnd = engineer.end_date ? toUTCDate(engineer.end_date) : qEnd
  const winStart = maxDate(qStart, eStart)
  const winEnd = minDate(qEnd, eEnd)

  if (winEnd < winStart || engineer.active === 0) {
    return {
      engineerId: engineer.id,
      name: engineer.name,
      workingDays: 0,
      holidayDays: 0,
      ptoDays: 0,
      effectiveWeeks: 0,
    }
  }

  const workingDays = countWeekdays(winStart, winEnd)

  // Public holidays for the engineer's country that fall on a weekday within the window.
  let holidayDays = 0
  for (const h of holidaysForCountry(engineer.country)) {
    const hd = toUTCDate(h.date)
    if (hd >= winStart && hd <= winEnd && isWeekday(hd)) holidayDays++
  }

  const availableAfterHolidays = Math.max(0, workingDays - holidayDays)
  const boundedPto = Math.max(0, Math.min(ptoDays, availableAfterHolidays))
  const effectiveDays = availableAfterHolidays - boundedPto
  const effectiveWeeks = (effectiveDays / DAYS_PER_WEEK) * engineer.capacity_fraction

  return {
    engineerId: engineer.id,
    name: engineer.name,
    workingDays,
    holidayDays,
    ptoDays: boundedPto,
    effectiveWeeks,
  }
}

export interface CapacityInputs {
  engineers: Engineer[]
  pto: PtoEntry[]
  settings: QuarterSetting[]
  initiatives: Initiative[]
  quarters: Quarter[]
}

export function computeCapacity(inputs: CapacityInputs): QuarterCapacity[] {
  const { engineers, pto, settings, initiatives, quarters } = inputs

  const ptoIndex = new Map<string, number>()
  for (const p of pto) ptoIndex.set(`${p.engineer_id}:${p.year}-Q${p.quarter}`, p.days)

  const bauIndex = new Map<string, number>()
  for (const s of settings) bauIndex.set(quarterKey(s), s.bau_pct)

  return quarters.map((q) => {
    const perEngineer = engineers
      .filter((e) => e.active === 1)
      .map((e) => computeEngineerQuarter(e, q, ptoIndex.get(`${e.id}:${quarterKey(q)}`) ?? 0))

    const grossWeeks = perEngineer.reduce((a, e) => a + e.effectiveWeeks, 0)
    const engineerCount = perEngineer.reduce(
      (a, e) => a + (e.effectiveWeeks > 0 ? 1 : 0),
      0
    )
    const bauPct = bauIndex.get(quarterKey(q)) ?? 0.2
    const bauWeeks = grossWeeks * bauPct
    const featureWeeks = grossWeeks - bauWeeks

    const inQuarter = initiatives.filter((i) => i.year === q.year && i.quarter === q.quarter)
    const committedWeeks = inQuarter
      .filter((i) => i.committed === 1)
      .reduce((a, i) => a + (i.effort_weeks ?? 0), 0)
    const plannedWeeks = inQuarter.reduce((a, i) => a + (i.effort_weeks ?? 0), 0)

    return {
      year: q.year,
      quarter: q.quarter,
      grossWeeks,
      bauPct,
      bauWeeks,
      featureWeeks,
      committedWeeks,
      plannedWeeks,
      headroomWeeks: featureWeeks - committedWeeks,
      utilizationPct: featureWeeks > 0 ? committedWeeks / featureWeeks : 0,
      engineerCount,
      perEngineer,
    }
  })
}

// Rounded to one decimal for display (weeks aren't meaningfully finer than that).
export function roundWeeks(n: number): number {
  return Math.round(n * 10) / 10
}
