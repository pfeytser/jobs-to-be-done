// Holiday calendars for the countries the team spans, covering 2026 through the
// end of 2027.
//
// 2026 US & Canada are the OFFICIAL Industrious holiday schedules (from the company
// PDFs): full days off use fraction 1; early-closure days (2pm / 12:30pm) use
// fraction 0.5. Region-only Canadian days (Ontario Family Day, Quebec Saint
// Jean-Baptiste) and the floating Personal Day are omitted. France and the
// Dominican Republic use national statutory holidays (Industrious’ Europe schedule
// has no France column). 2027 has no official Industrious calendar yet, so it falls
// back to national public holidays for every country — refresh when the 2027
// company schedules are published.
//
// Only weekday holidays reduce capacity (the engine filters weekends); a fractional
// entry reduces that day by its fraction.

export interface Holiday {
  date: string // ISO YYYY-MM-DD
  name: string
  fraction: number // portion of the working day off: 1 = full day, 0.5 = early closure
}

export const HOLIDAY_COUNTRIES = ["US", "CA", "FR", "DO"] as const
export type HolidayCountry = (typeof HOLIDAY_COUNTRIES)[number]

export const HOLIDAYS: Record<string, Holiday[]> = {
  // United States (official Industrious 2026 · national 2027)
  US: [
    { date: "2026-01-01", name: "New Year’s Day", fraction: 1 },
    { date: "2026-01-02", name: "New Year’s Day (Extended)", fraction: 1 },
    { date: "2026-01-19", name: "Dr. Martin Luther King Jr Day", fraction: 1 },
    { date: "2026-02-16", name: "President’s Day", fraction: 1 },
    { date: "2026-05-25", name: "Memorial Day", fraction: 1 },
    { date: "2026-06-19", name: "Juneteenth", fraction: 1 },
    { date: "2026-07-03", name: "Independence Day (Observed)", fraction: 1 },
    { date: "2026-09-07", name: "Labor Day", fraction: 1 },
    { date: "2026-10-12", name: "Indigenous Peoples’ Day", fraction: 1 },
    { date: "2026-11-03", name: "Election Day (2pm closure)", fraction: 0.5 },
    { date: "2026-11-11", name: "Veterans Day (2pm closure)", fraction: 0.5 },
    { date: "2026-11-25", name: "Thanksgiving Eve (2pm closure)", fraction: 0.5 },
    { date: "2026-11-26", name: "Thanksgiving", fraction: 1 },
    { date: "2026-11-27", name: "Native American Heritage Day", fraction: 1 },
    { date: "2026-12-24", name: "Christmas Eve (12:30pm closure)", fraction: 0.5 },
    { date: "2026-12-25", name: "Christmas Day", fraction: 1 },
    { date: "2026-12-31", name: "New Year’s Eve (2pm closure)", fraction: 0.5 },
    { date: "2027-01-01", name: "New Year's Day", fraction: 1 },
    { date: "2027-01-18", name: "Martin Luther King, Jr. Day", fraction: 1 },
    { date: "2027-02-15", name: "Washington's Birthday", fraction: 1 },
    { date: "2027-05-31", name: "Memorial Day", fraction: 1 },
    { date: "2027-06-18", name: "Juneteenth National Independence Day", fraction: 1 },
    { date: "2027-07-05", name: "Independence Day", fraction: 1 },
    { date: "2027-09-06", name: "Labor Day", fraction: 1 },
    { date: "2027-11-11", name: "Veterans Day", fraction: 1 },
    { date: "2027-11-25", name: "Thanksgiving Day", fraction: 1 },
    { date: "2027-12-24", name: "Christmas Day", fraction: 1 },
  ],
  // Canada (official Industrious 2026 · national 2027)
  CA: [
    { date: "2026-01-01", name: "New Year’s Day", fraction: 1 },
    { date: "2026-01-02", name: "New Year’s Day (Extended)", fraction: 1 },
    { date: "2026-04-03", name: "Good Friday", fraction: 1 },
    { date: "2026-04-06", name: "Easter Monday", fraction: 1 },
    { date: "2026-05-18", name: "Victoria Day", fraction: 1 },
    { date: "2026-07-01", name: "Canada Day", fraction: 1 },
    { date: "2026-08-03", name: "Civic Holiday", fraction: 1 },
    { date: "2026-09-07", name: "Labour Day", fraction: 1 },
    { date: "2026-09-30", name: "National Day for Truth and Reconciliation", fraction: 1 },
    { date: "2026-10-12", name: "Thanksgiving Day", fraction: 1 },
    { date: "2026-11-11", name: "Remembrance Day", fraction: 1 },
    { date: "2026-12-24", name: "Christmas Eve (12:30pm closure)", fraction: 0.5 },
    { date: "2026-12-25", name: "Christmas Day", fraction: 1 },
    { date: "2026-12-28", name: "Boxing Day (Observed)", fraction: 1 },
    { date: "2026-12-31", name: "New Year’s Eve (2pm closure)", fraction: 0.5 },
    { date: "2027-01-01", name: "New Year's Day", fraction: 1 },
    { date: "2027-03-26", name: "Good Friday", fraction: 1 },
    { date: "2027-05-24", name: "Victoria Day", fraction: 1 },
    { date: "2027-07-01", name: "Canada Day", fraction: 1 },
    { date: "2027-09-06", name: "Labour Day", fraction: 1 },
    { date: "2027-09-30", name: "National Day for Truth and Reconciliation", fraction: 1 },
    { date: "2027-10-11", name: "Thanksgiving", fraction: 1 },
    { date: "2027-12-25", name: "Christmas Day", fraction: 1 },
  ],
  // France (national statutory)
  FR: [
    { date: "2026-01-01", name: "Jour de l'an", fraction: 1 },
    { date: "2026-04-06", name: "Lundi de Pâques", fraction: 1 },
    { date: "2026-05-01", name: "Fête du Travail", fraction: 1 },
    { date: "2026-05-08", name: "Victoire 1945", fraction: 1 },
    { date: "2026-05-14", name: "Ascension", fraction: 1 },
    { date: "2026-05-25", name: "Lundi de Pentecôte", fraction: 1 },
    { date: "2026-07-14", name: "Fête nationale", fraction: 1 },
    { date: "2026-08-15", name: "Assomption", fraction: 1 },
    { date: "2026-11-01", name: "Toussaint", fraction: 1 },
    { date: "2026-11-11", name: "Armistice 1918", fraction: 1 },
    { date: "2026-12-25", name: "Noël", fraction: 1 },
    { date: "2027-01-01", name: "Jour de l'an", fraction: 1 },
    { date: "2027-03-29", name: "Lundi de Pâques", fraction: 1 },
    { date: "2027-05-01", name: "Fête du Travail", fraction: 1 },
    { date: "2027-05-06", name: "Ascension", fraction: 1 },
    { date: "2027-05-08", name: "Victoire 1945", fraction: 1 },
    { date: "2027-05-17", name: "Lundi de Pentecôte", fraction: 1 },
    { date: "2027-07-14", name: "Fête nationale", fraction: 1 },
    { date: "2027-08-15", name: "Assomption", fraction: 1 },
    { date: "2027-11-01", name: "Toussaint", fraction: 1 },
    { date: "2027-11-11", name: "Armistice 1918", fraction: 1 },
    { date: "2027-12-25", name: "Noël", fraction: 1 },
  ],
  // Dominican Republic (national)
  DO: [
    { date: "2026-01-01", name: "Día de Año Nuevo", fraction: 1 },
    { date: "2026-01-06", name: "Día de Reyes", fraction: 1 },
    { date: "2026-01-21", name: "Día de Nuestra Señora de la Altagracia", fraction: 1 },
    { date: "2026-01-26", name: "Día del Natalicio de Juan Pablo Duarte", fraction: 1 },
    { date: "2026-02-27", name: "Día de la Independencia de la República Dominicana", fraction: 1 },
    { date: "2026-04-03", name: "Good Friday", fraction: 1 },
    { date: "2026-05-01", name: "Día del Trabajador", fraction: 1 },
    { date: "2026-05-28", name: "Día de las Madres", fraction: 1 },
    { date: "2026-06-04", name: "Corpus Christi", fraction: 1 },
    { date: "2026-08-16", name: "Día de la Restauración Dominicana", fraction: 1 },
    { date: "2026-09-24", name: "Nuestra Senora de las Mercedes", fraction: 1 },
    { date: "2026-11-06", name: "Día de la Constitución", fraction: 1 },
    { date: "2026-12-25", name: "Navidad", fraction: 1 },
    { date: "2027-01-01", name: "Día de Año Nuevo", fraction: 1 },
    { date: "2027-01-06", name: "Día de Reyes", fraction: 1 },
    { date: "2027-01-21", name: "Día de Nuestra Señora de la Altagracia", fraction: 1 },
    { date: "2027-01-26", name: "Día del Natalicio de Juan Pablo Duarte", fraction: 1 },
    { date: "2027-02-27", name: "Día de la Independencia de la República Dominicana", fraction: 1 },
    { date: "2027-03-26", name: "Good Friday", fraction: 1 },
    { date: "2027-05-01", name: "Día del Trabajador", fraction: 1 },
    { date: "2027-05-27", name: "Corpus Christi", fraction: 1 },
    { date: "2027-05-28", name: "Día de las Madres", fraction: 1 },
    { date: "2027-08-16", name: "Día de la Restauración Dominicana", fraction: 1 },
    { date: "2027-09-24", name: "Nuestra Senora de las Mercedes", fraction: 1 },
    { date: "2027-11-06", name: "Día de la Constitución", fraction: 1 },
    { date: "2027-12-25", name: "Navidad", fraction: 1 },
  ],
}

export function holidaysForCountry(country: string): Holiday[] {
  return HOLIDAYS[country] ?? []
}
