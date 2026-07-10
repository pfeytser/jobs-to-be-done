import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { auth } from '@/lib/auth/config'
import { getPrototypeById } from '@/lib/db/prototypes'

// Streams the private blob back as the sandboxed iframe's src on /prototypes/[slug].
// Never linked directly — the blob store is private, so anonymous fetches 403.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const prototype = await getPrototypeById(id)
    if (!prototype) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (prototype.status !== 'active' && session.user.role !== 'admin') {
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
  } catch (error) {
    console.error('[prototypes/:id/render GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
