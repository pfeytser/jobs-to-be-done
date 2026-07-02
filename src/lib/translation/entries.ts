// Merge all datasets in a project into one entry list per language (brief FR-7).

import type { Entry, TranslationDataset, UiDatasetConfig, CsvDatasetConfig, MongoSnapshot } from './types'
import { flattenStrings, targetValueMap } from './json'
import { parseCsv, isTrivialValue } from './csv'
import { missingTokens } from './placeholders'
import { validateMarkup } from './markup'

// All locale codes present across a project's datasets, in stable order.
export function projectLanguages(datasets: TranslationDataset[]): string[] {
  const seen = new Set<string>()
  for (const ds of datasets) {
    if (ds.kind === 'ui') {
      for (const lang of Object.keys((ds.config as UiDatasetConfig).targets)) seen.add(lang)
    } else if (ds.kind === 'csv') {
      for (const lang of Object.keys((ds.config as CsvDatasetConfig).langColumns)) seen.add(lang)
    } else {
      const snapshot = JSON.parse(ds.english_source) as MongoSnapshot
      for (const doc of snapshot.entries) {
        for (const locales of Object.values(doc.fields)) {
          for (const locale of Object.keys(locales)) {
            if (locale !== 'en') seen.add(locale)
          }
        }
      }
    }
  }
  return [...seen].sort()
}

function finishEntry(
  base: Omit<Entry, 'edited' | 'empty' | 'identical' | 'placeholderWarning' | 'missingTokens' | 'tagError'>,
): Entry {
  const value = base.value
  const english = base.english
  const missing = missingTokens(english, value)
  return {
    ...base,
    edited: value !== base.original,
    empty: value.trim() === '' && english.trim() !== '',
    identical: value.trim() !== '' && value === english,
    placeholderWarning: missing.length > 0,
    missingTokens: missing,
    tagError: validateMarkup(english, value).error,
  }
}

// The English value for a single entry, for server-side validation of an incoming edit.
export function englishForEntry(ds: TranslationDataset, entryKey: string): string | null {
  if (ds.kind === 'ui') {
    for (const leaf of flattenStrings(JSON.parse(ds.english_source))) {
      if (leaf.path === entryKey) return leaf.value
    }
    return null
  }
  if (ds.kind === 'mongo') {
    const snapshot = JSON.parse(ds.english_source) as MongoSnapshot
    for (const doc of snapshot.entries) {
      for (const [fieldPath, locales] of Object.entries(doc.fields)) {
        if (`${snapshot.collection}.${doc._id}.${fieldPath}` === entryKey) return locales['en'] ?? ''
      }
    }
    return null
  }
  const config = ds.config as CsvDatasetConfig
  const parsed = parseCsv(ds.english_source)
  const englishIdx = parsed.headers.indexOf(config.englishColumn)
  const row = parsed.rows[Number(entryKey)]
  return row?.[englishIdx] ?? null
}

// Build entries for a Mongo snapshot dataset (brief-provided spec). Snapshot strings
// are plain text with no HTML-ish tags to protect, so unlike UI/CSV entries these skip
// markup validation and placeholder-token checks entirely.
function buildMongoEntries(ds: TranslationDataset, lang: string, edits: Map<string, string>): Entry[] {
  const snapshot = JSON.parse(ds.english_source) as MongoSnapshot
  const entries: Entry[] = []
  for (const doc of snapshot.entries) {
    for (const [fieldPath, locales] of Object.entries(doc.fields)) {
      const english = locales['en'] ?? ''
      const original = locales[lang] ?? ''
      const entryKey = `${snapshot.collection}.${doc._id}.${fieldPath}`
      const value = edits.has(entryKey) ? edits.get(entryKey)! : original
      entries.push({
        id: `${ds.id}:${entryKey}`,
        datasetId: ds.id,
        datasetName: ds.name,
        source: 'MONGO',
        entryKey,
        label: `${doc.displayName} — ${fieldPath}`,
        english,
        original,
        value,
        edited: value !== original,
        empty: value.trim() === '' && english.trim() !== '',
        identical: value.trim() !== '' && value === english,
        placeholderWarning: false,
        missingTokens: [],
        tagError: null,
      })
    }
  }
  return entries
}

// Build the merged entry list for one language. `editsByDataset` maps a dataset id to
// a map of entry_key -> edited value (already filtered to this language).
export function buildEntries(
  datasets: TranslationDataset[],
  lang: string,
  editsByDataset: Map<string, Map<string, string>>,
): Entry[] {
  const entries: Entry[] = []

  for (const ds of datasets) {
    const edits = editsByDataset.get(ds.id) ?? new Map<string, string>()

    if (ds.kind === 'ui') {
      const config = ds.config as UiDatasetConfig
      const targetFile = config.targets[lang]
      if (!targetFile) continue // this dataset has no file for this language
      const targetMap = targetValueMap(targetFile.text)
      for (const leaf of flattenStrings(JSON.parse(ds.english_source))) {
        const original = targetMap.get(leaf.path) ?? ''
        const value = edits.has(leaf.path) ? edits.get(leaf.path)! : original
        entries.push(
          finishEntry({
            id: `${ds.id}:${leaf.path}`,
            datasetId: ds.id,
            datasetName: ds.name,
            source: 'UI',
            entryKey: leaf.path,
            label: leaf.path,
            english: leaf.value,
            original,
            value,
          }),
        )
      }
    } else if (ds.kind === 'mongo') {
      entries.push(...buildMongoEntries(ds, lang, edits))
    } else {
      const config = ds.config as CsvDatasetConfig
      const langHeader = config.langColumns[lang]
      if (!langHeader) continue
      const parsed = parseCsv(ds.english_source)
      const englishIdx = parsed.headers.indexOf(config.englishColumn)
      const langIdx = parsed.headers.indexOf(langHeader)
      const labelIdxs = config.labelColumns
        .map((h) => parsed.headers.indexOf(h))
        .filter((i) => i >= 0)
      parsed.rows.forEach((row, i) => {
        const english = row[englishIdx] ?? ''
        if (isTrivialValue(english)) return // §10: skip non-translatable cells
        const original = row[langIdx] ?? ''
        const key = String(i)
        const value = edits.has(key) ? edits.get(key)! : original
        const labelParts = labelIdxs.map((idx) => (row[idx] ?? '').trim()).filter(Boolean)
        const label = labelParts.length > 0 ? labelParts.join(' · ') : `row ${i + 1}`
        entries.push(
          finishEntry({
            id: `${ds.id}:${key}`,
            datasetId: ds.id,
            datasetName: ds.name,
            source: 'DB',
            entryKey: key,
            label,
            english,
            original,
            value,
          }),
        )
      })
    }
  }

  return entries
}
