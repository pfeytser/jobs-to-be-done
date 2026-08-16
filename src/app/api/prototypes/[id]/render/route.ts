import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { requireUser, route } from '@/lib/auth/guards'
import { getPrototypeById } from '@/lib/db/prototypes'

// Streams the private blob back as the sandboxed iframe's src on /prototypes/[slug].
// Never linked directly — the blob store is private, so anonymous fetches 403.
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id } = await params
  const prototype = await getPrototypeById(id)
  if (!prototype) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (prototype.status !== 'active' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const result = await get(prototype.blob_pathname, { access: 'private' })
  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
  }

  return new Response(result.stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=60',
    },
  })
})
