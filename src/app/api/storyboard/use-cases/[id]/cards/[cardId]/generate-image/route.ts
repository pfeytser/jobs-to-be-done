import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getUseCaseById } from '@/lib/db/storyboard-use-cases'
import { getStoryboard } from '@/lib/db/storyboards'
import { getCardById, updateCard, saveImageIfLatest } from '@/lib/db/storyboard-cards'
import OpenAI from 'openai'

export const maxDuration = 60

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, cardId } = await params

    const useCase = await getUseCaseById(id)
    if (!useCase || useCase.status === 'present') return NextResponse.json({ ok: true })

    const storyboard = await getStoryboard(id, session.user.userId)
    if (!storyboard) return NextResponse.json({ ok: true })

    const card = await getCardById(cardId)
    if (!card || card.storyboard_id !== storyboard.id) return NextResponse.json({ ok: true })
    if (!card.scene_description.trim()) return NextResponse.json({ ok: true })

    // Mark the generation timestamp — used later to detect stale responses
    const requestedAt = new Date().toISOString()
    await updateCard(cardId, { generation_requested_at: requestedAt })

    const prompt = `In the style of 3d art, create a story board style image. The person is a ${storyboard.customer_role || 'professional'} at a ${storyboard.company_type || 'company'} company. They are responsible for an event like this: ${useCase.name}. In this storyboard scene, this is happening: ${card.scene_description}.`

    let dalleUrl: string | undefined
    try {
      const response = await getOpenAI().images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        response_format: 'url',
      })
      dalleUrl = response.data?.[0]?.url
    } catch (err) {
      console.error('[generate-image] DALL-E error:', err)
      return NextResponse.json({ ok: true })
    }

    if (!dalleUrl) return NextResponse.json({ ok: true })

    // Upload to Vercel Blob for a permanent URL; fall back to DALL-E URL if token not configured
    try {
      let finalUrl = dalleUrl
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const imageRes = await fetch(dalleUrl)
        if (!imageRes.ok) throw new Error('Failed to fetch image')
        const imageBuffer = await imageRes.arrayBuffer()
        const { put } = await import('@vercel/blob')
        const blob = await put(
          `storyboard-cards/${cardId}.png`,
          imageBuffer,
          { access: 'public', contentType: 'image/png', addRandomSuffix: false }
        )
        finalUrl = blob.url
      }
      // Only save if no newer request has superseded this one
      await saveImageIfLatest(cardId, finalUrl, requestedAt)
    } catch (err) {
      console.error('[generate-image] Image save error:', err)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[generate-image POST]', error)
    return NextResponse.json({ ok: true })
  }
}
