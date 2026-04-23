import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { generateCardImage } from '@/lib/storyboard/generate-card-image'

export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, cardId } = await params
    // Awaited here so the retry button can poll after 35s and expect the image to be ready
    await generateCardImage(id, cardId, session.user.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[generate-image POST]', error)
    return NextResponse.json({ ok: true })
  }
}
