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

import type { CompanyOffDay, Engineer, Initiative, PtoEntry, Quarter, QuarterSetting } from './types'
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
  revenue: number // $ revenue unlocked by initiatives landing this quarter
  hours: number // hours saved by initiatives landing this quarter
  perEngineer: EngineerQuarterCapacity[]
}

export interface EngineerQuarterCapacity {
  engineerId: string
  name: string
  workingDays: number
  holidayDays: number
  companyOffDays: number // team-wide off days not already a national holiday
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
  ptoDays: number,
  companyOffDates: Set<string>
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
      companyOffDays: 0,
      ptoDays: 0,
      effectiveWeeks: 0,
    }
  }

  const workingDays = countWeekdays(winStart, winEnd)

  // Public holidays for the engineer's country that fall on a weekday within the
  // window. Each contributes its fraction (full day = 1, early closure = 0.5).
  const holidayDates = new Set<string>()
  let holidayDays = 0
  for (const h of holidaysForCountry(engineer.country)) {
    const hd = toUTCDate(h.date)
    if (hd >= winStart && hd <= winEnd && isWeekday(hd)) {
      holidayDates.add(h.date)
      holidayDays += h.fraction
    }
  }

  // Company-wide off days that land on a weekday in the window and aren't already
  // one of this engineer's national holidays (avoid double-counting).
  let companyOffDays = 0
  for (const date of companyOffDates) {
    if (holidayDates.has(date)) continue
    const cd = toUTCDate(date)
    if (cd >= winStart && cd <= winEnd && isWeekday(cd)) companyOffDays++
  }

  const availableAfterOff = Math.max(0, workingDays - holidayDays - companyOffDays)
  const boundedPto = Math.max(0, Math.min(ptoDays, availableAfterOff))
  const effectiveDays = availableAfterOff - boundedPto
  const effectiveWeeks = (effectiveDays / DAYS_PER_WEEK) * engineer.capacity_fraction

  return {
    engineerId: engineer.id,
    name: engineer.name,
    workingDays,
    holidayDays,
    companyOffDays,
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
  companyOffDays?: CompanyOffDay[]
}

export function computeCapacity(inputs: CapacityInputs): QuarterCapacity[] {
  const { engineers, pto, settings, initiatives, quarters, companyOffDays = [] } = inputs

  const ptoIndex = new Map<string, number>()
  for (const p of pto) ptoIndex.set(`${p.engineer_id}:${p.year}-Q${p.quarter}`, p.days)

  const bauIndex = new Map<string, number>()
  for (const s of settings) bauIndex.set(quarterKey(s), s.bau_pct)

  const companyOffDates = new Set(companyOffDays.map((d) => d.date))

  return quarters.map((q) => {
    const perEngineer = engineers
      .filter((e) => e.active === 1)
      .map((e) => computeEngineerQuarter(e, q, ptoIndex.get(`${e.id}:${quarterKey(q)}`) ?? 0, companyOffDates))

    const grossWeeks = perEngineer.reduce((a, e) => a + e.effectiveWeeks, 0)
    // Headcount weighted by FTE: a 0.5 engineering manager counts as 0.5, so a team
    // of four full engineers + one half-time EM shows as 4.5, not 5.
    const fracById = new Map(engineers.map((e) => [e.id, e.capacity_fraction]))
    const engineerCount = perEngineer.reduce(
      (a, e) => a + (e.effectiveWeeks > 0 ? fracById.get(e.engineerId) ?? 0 : 0),
      0
    )
    const bauPct = bauIndex.get(quarterKey(q)) ?? 0.2
    const bauWeeks = grossWeeks * bauPct
    const featureWeeks = grossWeeks - bauWeeks

    // Unscheduled ("To Be Prioritized") work isn't placed in a quarter, so it never
    // counts against that quarter's capacity.
    const inQuarter = initiatives.filter(
      (i) => i.year === q.year && i.quarter === q.quarter && i.unscheduled !== 1
    )
    const committedWeeks = inQuarter
      .filter((i) => i.committed === 1)
      .reduce((a, i) => a + (i.effort_weeks ?? 0), 0)
    const plannedWeeks = inQuarter.reduce((a, i) => a + (i.effort_weeks ?? 0), 0)
    const revenue = inQuarter.reduce((a, i) => a + (i.impact_revenue ?? 0), 0)
    const hours = inQuarter.reduce((a, i) => a + (i.impact_hours ?? 0), 0)

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
      revenue,
      hours,
      perEngineer,
    }
  })
}

// Rounded to one decimal for display (weeks aren't meaningfully finer than that).
export function roundWeeks(n: number): number {
  return Math.round(n * 10) / 10
}
