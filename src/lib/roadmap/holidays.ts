// National public-holiday calendars for the countries the team spans, covering
// 2026 through the end of 2027. Sourced from the Nager.Date public-holiday API
// (nationwide "Public" holidays only — provincial/regional days are excluded) and
// baked in as a static calendar so capacity planning has no runtime dependency.
//
// Only weekday holidays reduce capacity — the engine filters weekends — but the
// full list is kept so the in-app calendar can show every national day off.

export interface Holiday {
  date: string // ISO YYYY-MM-DD
  name: string
}

export const HOLIDAY_COUNTRIES = ["US", "CA", "FR", "DO"] as const
export type HolidayCountry = (typeof HOLIDAY_COUNTRIES)[number]

export const HOLIDAYS: Record<string, Holiday[]> = {
  // United States
  US: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-01-19", name: "Martin Luther King, Jr. Day" },
    { date: "2026-02-16", name: "Washington's Birthday" },
    { date: "2026-05-25", name: "Memorial Day" },
    { date: "2026-06-19", name: "Juneteenth National Independence Day" },
    { date: "2026-07-03", name: "Independence Day" },
    { date: "2026-09-07", name: "Labor Day" },
    { date: "2026-11-11", name: "Veterans Day" },
    { date: "2026-11-26", name: "Thanksgiving Day" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2027-01-01", name: "New Year's Day" },
    { date: "2027-01-18", name: "Martin Luther King, Jr. Day" },
    { date: "2027-02-15", name: "Washington's Birthday" },
    { date: "2027-05-31", name: "Memorial Day" },
    { date: "2027-06-18", name: "Juneteenth National Independence Day" },
    { date: "2027-07-05", name: "Independence Day" },
    { date: "2027-09-06", name: "Labor Day" },
    { date: "2027-11-11", name: "Veterans Day" },
    { date: "2027-11-25", name: "Thanksgiving Day" },
    { date: "2027-12-24", name: "Christmas Day" },
  ],
  // Canada
  CA: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-05-18", name: "Victoria Day" },
    { date: "2026-07-01", name: "Canada Day" },
    { date: "2026-09-07", name: "Labour Day" },
    { date: "2026-09-30", name: "National Day for Truth and Reconciliation" },
    { date: "2026-10-12", name: "Thanksgiving" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2027-01-01", name: "New Year's Day" },
    { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-05-24", name: "Victoria Day" },
    { date: "2027-07-01", name: "Canada Day" },
    { date: "2027-09-06", name: "Labour Day" },
    { date: "2027-09-30", name: "National Day for Truth and Reconciliation" },
    { date: "2027-10-11", name: "Thanksgiving" },
    { date: "2027-12-25", name: "Christmas Day" },
  ],
  // France
  FR: [
    { date: "2026-01-01", name: "Jour de l'an" },
    { date: "2026-04-06", name: "Lundi de Pâques" },
    { date: "2026-05-01", name: "Fête du Travail" },
    { date: "2026-05-08", name: "Victoire 1945" },
    { date: "2026-05-14", name: "Ascension" },
    { date: "2026-05-25", name: "Lundi de Pentecôte" },
    { date: "2026-07-14", name: "Fête nationale" },
    { date: "2026-08-15", name: "Assomption" },
    { date: "2026-11-01", name: "Toussaint" },
    { date: "2026-11-11", name: "Armistice 1918" },
    { date: "2026-12-25", name: "Noël" },
    { date: "2027-01-01", name: "Jour de l'an" },
    { date: "2027-03-29", name: "Lundi de Pâques" },
    { date: "2027-05-01", name: "Fête du Travail" },
    { date: "2027-05-06", name: "Ascension" },
    { date: "2027-05-08", name: "Victoire 1945" },
    { date: "2027-05-17", name: "Lundi de Pentecôte" },
    { date: "2027-07-14", name: "Fête nationale" },
    { date: "2027-08-15", name: "Assomption" },
    { date: "2027-11-01", name: "Toussaint" },
    { date: "2027-11-11", name: "Armistice 1918" },
    { date: "2027-12-25", name: "Noël" },
  ],
  // Dominican Republic
  DO: [
    { date: "2026-01-01", name: "Día de Año Nuevo" },
    { date: "2026-01-06", name: "Día de Reyes" },
    { date: "2026-01-21", name: "Día de Nuestra Señora de la Altagracia" },
    { date: "2026-01-26", name: "Día del Natalicio de Juan Pablo Duarte" },
    { date: "2026-02-27", name: "Día de la Independencia de la República Dominicana" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-05-01", name: "Día del Trabajador" },
    { date: "2026-05-28", name: "Día de las Madres" },
    { date: "2026-06-04", name: "Corpus Christi" },
    { date: "2026-08-16", name: "Día de la Restauración Dominicana" },
    { date: "2026-09-24", name: "Nuestra Senora de las Mercedes" },
    { date: "2026-11-06", name: "Día de la Constitución" },
    { date: "2026-12-25", name: "Navidad" },
    { date: "2027-01-01", name: "Día de Año Nuevo" },
    { date: "2027-01-06", name: "Día de Reyes" },
    { date: "2027-01-21", name: "Día de Nuestra Señora de la Altagracia" },
    { date: "2027-01-26", name: "Día del Natalicio de Juan Pablo Duarte" },
    { date: "2027-02-27", name: "Día de la Independencia de la República Dominicana" },
    { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-05-01", name: "Día del Trabajador" },
    { date: "2027-05-27", name: "Corpus Christi" },
    { date: "2027-05-28", name: "Día de las Madres" },
    { date: "2027-08-16", name: "Día de la Restauración Dominicana" },
    { date: "2027-09-24", name: "Nuestra Senora de las Mercedes" },
    { date: "2027-11-06", name: "Día de la Constitución" },
    { date: "2027-12-25", name: "Navidad" },
  ],
}

export function holidaysForCountry(country: string): Holiday[] {
  return HOLIDAYS[country] ?? []
}
