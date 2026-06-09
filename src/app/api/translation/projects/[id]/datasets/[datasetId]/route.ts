import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isTranslationOwner } from '@/lib/translation/access'
import { getDataset, deleteDataset } from '@/lib/db/translation'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; datasetId: string }> },
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isTranslationOwner(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id, datasetId } = await params
  const dataset = await getDataset(datasetId)
  if (!dataset || dataset.project_id !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await deleteDataset(datasetId)
  return NextResponse.json({ ok: true })
}
