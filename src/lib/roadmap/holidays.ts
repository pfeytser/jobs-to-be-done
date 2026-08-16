// Curated public-holiday reference for the countries the Growth team spans, for
// the quarters the roadmap covers (2026 full year + Q1 2027). These are planning
// assumptions, not a legal calendar — the point is to discount each engineer's
// available weeks by the public holidays of where they live. Weekend holidays are
// harmless: the capacity engine only counts holidays that land on a weekday.

export interface Holiday {
  date: string // ISO YYYY-MM-DD
  name: string
}

export const HOLIDAYS: Record<string, Holiday[]> = {
  US: [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-01-19', name: 'MLK Jr. Day' },
    { date: '2026-02-16', name: "Presidents' Day" },
    { date: '2026-05-25', name: 'Memorial Day' },
    { date: '2026-06-19', name: 'Juneteenth' },
    { date: '2026-07-03', name: 'Independence Day (observed)' },
    { date: '2026-09-07', name: 'Labor Day' },
    { date: '2026-11-26', name: 'Thanksgiving' },
    { date: '2026-11-27', name: 'Day after Thanksgiving' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2027-01-01', name: "New Year's Day" },
    { date: '2027-01-18', name: 'MLK Jr. Day' },
    { date: '2027-02-15', name: "Presidents' Day" },
  ],
  FR: [
    { date: '2026-01-01', name: "Jour de l'An" },
    { date: '2026-04-06', name: 'Lundi de Pâques' },
    { date: '2026-05-01', name: 'Fête du Travail' },
    { date: '2026-05-08', name: 'Victoire 1945' },
    { date: '2026-05-14', name: 'Ascension' },
    { date: '2026-05-25', name: 'Lundi de Pentecôte' },
    { date: '2026-07-14', name: 'Fête Nationale' },
    { date: '2026-08-15', name: 'Assomption' },
    { date: '2026-11-01', name: 'Toussaint' },
    { date: '2026-11-11', name: 'Armistice 1918' },
    { date: '2026-12-25', name: 'Noël' },
    { date: '2027-01-01', name: "Jour de l'An" },
    { date: '2027-03-29', name: 'Lundi de Pâques' },
  ],
  SG: [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-02-17', name: 'Chinese New Year' },
    { date: '2026-02-18', name: 'Chinese New Year' },
    { date: '2026-03-21', name: 'Hari Raya Puasa' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-05-01', name: 'Labour Day' },
    { date: '2026-05-27', name: 'Hari Raya Haji' },
    { date: '2026-05-31', name: 'Vesak Day' },
    { date: '2026-08-09', name: 'National Day' },
    { date: '2026-11-08', name: 'Deepavali' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2027-01-01', name: "New Year's Day" },
    { date: '2027-02-06', name: 'Chinese New Year' },
    { date: '2027-02-07', name: 'Chinese New Year' },
  ],
  UK: [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-06', name: 'Easter Monday' },
    { date: '2026-05-04', name: 'Early May Bank Holiday' },
    { date: '2026-05-25', name: 'Spring Bank Holiday' },
    { date: '2026-08-31', name: 'Summer Bank Holiday' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2026-12-28', name: 'Boxing Day (observed)' },
    { date: '2027-01-01', name: "New Year's Day" },
    { date: '2027-03-26', name: 'Good Friday' },
  ],
}

export function holidaysForCountry(country: string): Holiday[] {
  return HOLIDAYS[country] ?? []
}
