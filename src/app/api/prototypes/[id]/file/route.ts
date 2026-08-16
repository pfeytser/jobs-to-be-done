import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { getPrototypeById, replacePrototypeFile } from '@/lib/db/prototypes'
import { storePrototypeHtml, isHtmlFileName, MAX_PROTOTYPE_BYTES } from '@/lib/prototypes/storage'

// Replace-file action for the management UI, used when the caller already has the
// prototype's id on screen (the API-token upload path instead goes through
// POST /api/prototypes with a slug, since a remote Claude session won't have the id).
export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()

  const { id } = await params
  const prototype = await getPrototypeById(id)
  if (!prototype) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (!isHtmlFileName(file.name)) {
    return NextResponse.json({ error: 'File must be .html or .htm' }, { status: 400 })
  }
  if (file.size > MAX_PROTOTYPE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 15MB limit' }, { status: 400 })
  }

  const html = Buffer.from(await file.arrayBuffer()).toString('utf-8')
  const blob = await storePrototypeHtml(prototype.blob_pathname, html)
  const updated = await replacePrototypeFile(id, { blob_url: blob.url, file_size: file.size })
  return NextResponse.json({ prototype: updated })
})
