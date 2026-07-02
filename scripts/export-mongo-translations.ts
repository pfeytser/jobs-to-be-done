/**
 * Export a translation snapshot from the inventory-service MongoDB for the
 * Translation Review tool's "MongoDB Snapshot" source.
 *
 * Run:
 *   npx tsx scripts/export-mongo-translations.ts --collection locations|amenities --uri <MONGODB_URI> --output <path>
 *
 * Flags:
 *   --collection   "locations" or "amenities" (required)
 *   --uri          MongoDB connection string (or set MONGODB_URI env var)
 *   --output       Path to write the snapshot JSON (required)
 *
 * What it exports:
 *   locations  — the Translations() fields: parkingGuest, parkingAlt, carParking,
 *                bikeRacks, bikeParking, buildingCheckInInstructions, tourInstructions,
 *                summary, salesHighlightBanner, metaDescription, featuredPromoBanner,
 *                wifiInstructions, spotlight.title, spotlight.description — plus the
 *                array fields parkingInfos, transitInfos[].description,
 *                lodgingAndDining, attractions (flattened as `field.0`, `field.1`, …).
 *                displayName = doc.name || doc.slug. Fields with an empty English
 *                value are skipped.
 *   amenities  — the `label` field (a TranslationsWithEnglish object).
 *                displayName = doc.code.
 *
 * Output shape (uploaded as-is to the Translation Review tool):
 *   {
 *     "collection": "locations",
 *     "exportedAt": "<ISO timestamp>",
 *     "entries": [
 *       {
 *         "_id": "<mongo ObjectId as string>",
 *         "displayName": "Bryant Park",
 *         "fields": {
 *           "parkingGuest": { "en": "...", "fr": "...", "zh_Hans": "...", ... },
 *           "spotlight.title": { "en": "...", ... },
 *           "parkingInfos.0": { "en": "...", ... }
 *         }
 *       }
 *     ]
 *   }
 *
 * Locale codes are exported as-is (underscore form, e.g. `zh_Hans`) — the app
 * normalizes them to hyphenated codes (`zh-Hans`) on upload.
 */
import fs from 'fs'
import path from 'path'
import { MongoClient, type Document } from 'mongodb'

const LOCALES = ['en', 'fr', 'de', 'nl', 'es', 'th', 'zh_Hans', 'zh_Hant']

const LOCATION_SCALAR_FIELDS = [
  'parkingGuest',
  'parkingAlt',
  'carParking',
  'bikeRacks',
  'bikeParking',
  'buildingCheckInInstructions',
  'tourInstructions',
  'summary',
  'salesHighlightBanner',
  'metaDescription',
  'featuredPromoBanner',
  'wifiInstructions',
  'spotlight.title',
  'spotlight.description',
]

const LOCATION_ARRAY_FIELDS: { path: string; subField?: string }[] = [
  { path: 'parkingInfos' },
  { path: 'transitInfos', subField: 'description' },
  { path: 'lodgingAndDining' },
  { path: 'attractions' },
]

function flag(name: string): string | undefined {
  const pref = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(pref))
  return hit ? hit.slice(pref.length) : undefined
}

function getAtPath(obj: unknown, dotPath: string): unknown {
  return dotPath.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

// Pick only the known locale keys out of a Mongo translations sub-document, coercing
// to strings. Returns null if there's no (non-empty) English value.
function normalizeTranslations(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const en = source.en
  if (typeof en !== 'string' || en.trim() === '') return null
  const out: Record<string, string> = {}
  for (const locale of LOCALES) {
    const v = source[locale]
    if (typeof v === 'string') out[locale] = v
  }
  return out
}

function buildLocationFields(doc: Document): Record<string, Record<string, string>> {
  const fields: Record<string, Record<string, string>> = {}

  for (const fieldPath of LOCATION_SCALAR_FIELDS) {
    const translations = normalizeTranslations(getAtPath(doc, fieldPath))
    if (translations) fields[fieldPath] = translations
  }

  for (const { path: arrPath, subField } of LOCATION_ARRAY_FIELDS) {
    const arr = doc[arrPath]
    if (!Array.isArray(arr)) continue
    arr.forEach((item, i) => {
      const raw = subField ? (item as Record<string, unknown> | null)?.[subField] : item
      const translations = normalizeTranslations(raw)
      if (!translations) return
      const fieldPath = subField ? `${arrPath}.${i}.${subField}` : `${arrPath}.${i}`
      fields[fieldPath] = translations
    })
  }

  return fields
}

function buildAmenityFields(doc: Document): Record<string, Record<string, string>> {
  const fields: Record<string, Record<string, string>> = {}
  const translations = normalizeTranslations(doc.label)
  if (translations) fields.label = translations
  return fields
}

async function main() {
  const collection = flag('collection')
  const uri = flag('uri') ?? process.env.MONGODB_URI
  const output = flag('output')

  if (collection !== 'locations' && collection !== 'amenities') {
    console.error(
      'Usage: npx tsx scripts/export-mongo-translations.ts --collection locations|amenities --uri <MONGODB_URI> --output <path>',
    )
    process.exit(1)
  }
  if (!uri) {
    console.error('Missing --uri (or set the MONGODB_URI environment variable).')
    process.exit(1)
  }
  if (!output) {
    console.error('Missing --output <path>.')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const db = client.db()
    const docs = await db.collection(collection).find({}).toArray()

    const entries = []
    for (const doc of docs) {
      const fields = collection === 'locations' ? buildLocationFields(doc) : buildAmenityFields(doc)
      if (Object.keys(fields).length === 0) continue
      const displayName =
        collection === 'locations'
          ? (doc.name as string | undefined) || (doc.slug as string | undefined) || String(doc._id)
          : (doc.code as string | undefined) || String(doc._id)
      entries.push({ _id: String(doc._id), displayName, fields })
    }

    const snapshot = { collection, exportedAt: new Date().toISOString(), entries }
    fs.writeFileSync(path.resolve(output), JSON.stringify(snapshot, null, 2) + '\n', 'utf-8')
    console.log(`Wrote ${entries.length} ${collection} entries to ${output}`)
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
