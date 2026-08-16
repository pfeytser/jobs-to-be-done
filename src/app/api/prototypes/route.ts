import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireAdmin, route } from '@/lib/auth/guards'
import {
  getAllPrototypes,
  getActivePrototypes,
  getPrototypeBySlug,
  createPrototype,
  replacePrototypeFile,
  reserveSlug,
} from '@/lib/db/prototypes'
import { storePrototypeHtml, isHtmlFileName, MAX_PROTOTYPE_BYTES } from '@/lib/prototypes/storage'

export const GET = route(async () => {
  const user = await requireUser()

  const prototypes =
    user.role === 'admin' ? await getAllPrototypes() : await getActivePrototypes()
  return NextResponse.json({ prototypes })
})

export const POST = route(async (req: NextRequest) => {
  const user = await requireAdmin()

  const formData = await req.formData()
  const file = formData.get('file')
  const name = formData.get('name')
  const slug = formData.get('slug')

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

  // Updating an existing prototype by slug — the "delete old, upload new" path,
  // usable without knowing the internal id.
  if (typeof slug === 'string' && slug.trim()) {
    const existing = await getPrototypeBySlug(slug.trim())
    if (existing) {
      const blob = await storePrototypeHtml(existing.blob_pathname, html)
      const updated = await replacePrototypeFile(existing.id, { blob_url: blob.url, file_size: file.size })
      return NextResponse.json({ prototype: updated, created: false })
    }
  }

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  }

  const id = `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const created_by = user.userId
  const created_by_name = user.name ?? user.email ?? ''
  const created_via = 'web'

  const resolvedSlug = await reserveSlug(name.trim(), id.slice(-8))
  const pathname = `prototypes/${resolvedSlug}.html`
  const blob = await storePrototypeHtml(pathname, html)
  const prototype = await createPrototype({
    id,
    slug: resolvedSlug,
    name: name.trim(),
    blob_pathname: pathname,
    blob_url: blob.url,
    file_size: file.size,
    created_by,
    created_by_name,
    created_via,
  })

  return NextResponse.json({ prototype, created: true }, { status: 201 })
})
