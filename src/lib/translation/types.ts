// Shared types for the Translation Review tool.

export type DatasetKind = 'ui' | 'csv'

export interface TranslationProject {
  id: string
  name: string
  created_at: string
  updated_at: string
}

// A target-language file as originally loaded for a UI dataset. We keep the raw text
// so exports can fall back to the original value at any untouched key.
export interface UiTargetFile {
  fileName: string
  text: string
}

// config_json shape for a UI (JSON) dataset.
export interface UiDatasetConfig {
  englishFileName: string
  // locale code -> originally-loaded target file
  targets: Record<string, UiTargetFile>
  // structural mismatches found at load time (advisory, reported in setup)
  mismatches?: Record<string, { missingInTarget: string[]; extraInTarget: string[] }>
}

// config_json shape for a CSV (DB export) dataset.
export interface CsvDatasetConfig {
  fileName?: string
  headers: string[]
  englishColumn: string
  // locale code -> the CSV column header that holds that language
  langColumns: Record<string, string>
  // columns used to build a human-readable row label (ids / paths)
  labelColumns: string[]
  // detected line ending of the original file, reused on export
  eol: '\r\n' | '\n'
}

export interface TranslationDataset {
  id: string
  project_id: string
  kind: DatasetKind
  name: string
  english_source: string
  config: UiDatasetConfig | CsvDatasetConfig
  created_at: string
}

// Dataset metadata sent to the client (without the bulky source text).
export interface DatasetMeta {
  id: string
  kind: DatasetKind
  name: string
  config: UiDatasetConfig | CsvDatasetConfig
}

export interface TranslationEdit {
  dataset_id: string
  lang: string
  entry_key: string
  value: string
  updated_by: string | null
  updated_at: string
}

// One translatable unit shown as a table row, merged across datasets for a language.
export interface Entry {
  // stable id: `${datasetId}:${entryKey}`
  id: string
  datasetId: string
  datasetName: string
  source: 'UI' | 'DB'
  entryKey: string
  // human-readable label (key path or CSV row label)
  label: string
  english: string
  // the value originally loaded for this language (before any edits)
  original: string
  // current value = edit if one exists, else original
  value: string
  edited: boolean
  empty: boolean
  identical: boolean
  placeholderWarning: boolean
  missingTokens: string[]
  // Non-null when the translation's tags don't match the English (blocks saving).
  tagError: string | null
}

export interface LangProgress {
  total: number
  translated: number
  edited: number
  warnings: number
}
