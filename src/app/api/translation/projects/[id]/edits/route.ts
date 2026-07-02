import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth/config'
import { getDataset, upsertEdit, deleteEdit } from '@/lib/db/translation'
import { englishForEntry } from '@/lib/translation/entries'
import { validateMarkup } from '@/lib/translation/markup'

export const dynamic = 'force-dynamic'

const EditSchema = z.object({
  datasetId: z.string().min(1),
  lang: z.string().min(1),
  entryKey: z.string(),
  value: z.string(),
})

// Any logged-in user may edit a translation value. Autosave posts here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = EditSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid edit' }, { status: 400 })
  const { datasetId, lang, entryKey, value } = parsed.data

  const dataset = await getDataset(datasetId)
  if (!dataset || dataset.project_id !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Never persist broken markup: the translation's tags must match the English's.
  // Mongo snapshot strings are plain text (no chip editor, no tag toolbar), so they're
  // exempt from markup validation entirely.
  if (dataset.kind !== 'mongo') {
    const english = englishForEntry(dataset, entryKey)
    const markup = validateMarkup(english ?? '', value)
    if (!markup.ok) {
      return NextResponse.json({ error: markup.error ?? 'Formatting tags do not match the English.' }, { status: 422 })
    }
  }

  await upsertEdit(datasetId, lang, entryKey, value, session.user.email ?? null)
  return NextResponse.json({ ok: true })
}

const RevertSchema = z.object({
  datasetId: z.string().min(1),
  lang: z.string().min(1),
  entryKey: z.string(),
})

// Revert an entry to its originally-loaded value by removing the stored edit (FR-14).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = RevertSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { datasetId, lang, entryKey } = parsed.data

  const dataset = await getDataset(datasetId)
  if (!dataset || dataset.project_id !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await deleteEdit(datasetId, lang, entryKey)
  return NextResponse.json({ ok: true })
}
