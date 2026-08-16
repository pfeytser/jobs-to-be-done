import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { isTranslationOwner } from '@/lib/translation/access'
import { getDataset, deleteDataset } from '@/lib/db/translation'

export const dynamic = 'force-dynamic'

export const DELETE = route(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; datasetId: string }> },
) => {
  const user = await requireUser()
  if (!isTranslationOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id, datasetId } = await params
  const dataset = await getDataset(datasetId)
  if (!dataset || dataset.project_id !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await deleteDataset(datasetId)
  return NextResponse.json({ ok: true })
})
