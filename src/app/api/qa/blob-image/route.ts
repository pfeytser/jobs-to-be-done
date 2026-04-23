import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'

const ALLOWED_HOSTNAME = 'blob.vercel-storage.com'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  if (!parsed.hostname.endsWith(ALLOWED_HOSTNAME)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })

  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!upstream.ok) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: upstream.status })
  }

  const contentType = upstream.headers.get('Content-Type') ?? 'image/png'
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
