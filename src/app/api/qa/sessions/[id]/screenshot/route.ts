import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { put } from '@vercel/blob'
import { getSessionById } from '@/lib/db/qa-sessions'
import { updateResultScreenshot } from '@/lib/db/qa-results'
import { getTestItemById } from '@/lib/db/qa-test-items'

const MAX_SIZE = 10 * 1024 * 1024

function slugify(str: string, maxLen = 30): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen)
}

function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  try {
    const qaSession = await getSessionById(sessionId)
    if (!qaSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.user.role !== 'admin' && qaSession.tester_id !== session.user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const testItemId = formData.get('test_item_id') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!testItemId) return NextResponse.json({ error: 'test_item_id required' }, { status: 400 })
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
    }

    const testItem = await getTestItemById(testItemId)
    if (!testItem) return NextResponse.json({ error: 'Test item not found' }, { status: 404 })

    // Build standardized filename
    const firstName = (session.user.name ?? 'user').split(' ')[0].toLowerCase().replace(/\s+/g, '')
    const testerId = sanitizeForFilename(session.user.userId.replace(/[^a-z0-9]/gi, '').slice(0, 20))
    const featureSlug = slugify(testItem.feature_area)
    const tcSlug = sanitizeForFilename(testItem.tc_number || testItemId.slice(-6)).replace(/-+/g, '-')
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const filename = `${firstName}_${testerId}_${featureSlug}_${tcSlug}.${ext}`

    const blob = await put(`qa-screenshots/${qaSession.project_id}/${filename}`, file, {
      access: 'private',
      addRandomSuffix: false,
    })

    await updateResultScreenshot(sessionId, testItemId, blob.url, filename)

    return NextResponse.json({ url: blob.url, filename })
  } catch (error) {
    console.error('[qa/screenshot POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
