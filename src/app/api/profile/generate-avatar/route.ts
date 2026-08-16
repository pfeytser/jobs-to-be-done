import { NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getUserProfile, saveSeaCreatureAvatar } from '@/lib/db/user-profiles'
import { rateLimit } from '@/lib/rate-limit'
import OpenAI from 'openai'

export const maxDuration = 60

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export const POST = route(async () => {
  const user = await requireUser()

  // Cap DALL-E avatar regenerations per user (the avatar overwrites itself, so
  // real usage is low) to prevent cost-abuse loops.
  const limit = await rateLimit(`avatar:${user.userId}`, 10, 60 * 60)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    )
  }

  try {
    const profile = await getUserProfile(user.userId)
    if (!profile?.sea_creature) {
      return NextResponse.json({ error: 'No sea creature set' }, { status: 400 })
    }

    const prompt = `In the style of digital 3d art, create a profile picture of a ${profile.sea_creature} who is known for ${profile.sea_creature_why ?? 'being unique'}.`

    const response = await getOpenAI().images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    })

    const dalleUrl = response.data?.[0]?.url
    if (!dalleUrl) {
      return NextResponse.json({ error: 'No image returned' }, { status: 502 })
    }

    // Upload to Vercel Blob for a permanent URL; fall back to DALL-E URL if token not configured
    let finalUrl = dalleUrl
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const imageRes = await fetch(dalleUrl)
        if (!imageRes.ok) throw new Error('Failed to fetch generated image')
        const imageBuffer = await imageRes.arrayBuffer()
        const { put } = await import('@vercel/blob')
        const blob = await put(
          `sea-creature-avatars/${user.userId}.png`,
          imageBuffer,
          { access: 'public', contentType: 'image/png', addRandomSuffix: false }
        )
        finalUrl = blob.url
      } catch (err) {
        console.warn('[generate-avatar] Blob upload failed, using DALL-E URL directly:', err)
      }
    }

    await saveSeaCreatureAvatar(user.userId, finalUrl)
    return NextResponse.json({ avatar_url: finalUrl })
  } catch (error) {
    console.error('[generate-avatar POST]', error)
    return NextResponse.json({ error: 'Image generation failed' }, { status: 502 })
  }
})
