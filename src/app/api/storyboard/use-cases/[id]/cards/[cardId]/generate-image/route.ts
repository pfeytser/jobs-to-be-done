import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { generateCardImage } from '@/lib/storyboard/generate-card-image'

export const maxDuration = 60

export const POST = route(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) => {
  const user = await requireUser()

  try {
    const { id, cardId } = await params
    // Awaited here so the retry button can poll after 35s and expect the image to be ready
    await generateCardImage(id, cardId, user.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[generate-image POST]', error)
    return NextResponse.json({ ok: true })
  }
})
