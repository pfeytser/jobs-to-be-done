import { getUseCaseById } from '@/lib/db/storyboard-use-cases'
import { getStoryboard } from '@/lib/db/storyboards'
import { getCardById, updateCard, saveImageIfLatest } from '@/lib/db/storyboard-cards'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

/**
 * Generate and persist a DALL-E image for a storyboard card.
 * Safe to call fire-and-forget (`void generateCardImage(...)`).
 * Returns silently on any validation failure so callers never throw.
 */
export async function generateCardImage(useCaseId: string, cardId: string, userId: string) {
  try {
    console.log(`[generate-card-image] START useCaseId=${useCaseId} cardId=${cardId} userId=${userId}`)

    const useCase = await getUseCaseById(useCaseId)
    if (!useCase) { console.log('[generate-card-image] use case not found — skipping'); return }
    if (useCase.status === 'present') { console.log('[generate-card-image] use case is in present mode — skipping'); return }

    const storyboard = await getStoryboard(useCaseId, userId)
    if (!storyboard) { console.log('[generate-card-image] storyboard not found — skipping'); return }

    const card = await getCardById(cardId)
    if (!card || card.storyboard_id !== storyboard.id) {
      console.log('[generate-card-image] card not found or ownership mismatch — skipping')
      return
    }
    if (!card.scene_description.trim()) {
      console.log('[generate-card-image] empty description — skipping')
      return
    }

    // Stamp generation_requested_at BEFORE calling OpenAI so we can detect stale responses
    const requestedAt = new Date().toISOString()
    await updateCard(cardId, { generation_requested_at: requestedAt })
    console.log(`[generate-card-image] generation_requested_at stamped as ${requestedAt}`)

    const whoLines = [
      storyboard.customer_name || 'A professional',
      storyboard.customer_demographics || null,
      storyboard.customer_role ? `working as ${storyboard.customer_role}` : null,
      storyboard.company_type ? `at a ${storyboard.company_type}` : null,
    ].filter(Boolean).join(', ')

    const prompt = [
      'Photorealistic commercial lifestyle photograph.',
      `Primary subject and action (make this the clear visual focus): ${card.scene_description}`,
      'Set the environment based on what the scene actually describes — if the scene takes place at home, show a home; if in a car or on the street, show that; only depict the Industrious coworking space (warm wood accents, white walls, soft ambient lighting, floor-to-ceiling windows, glass-walled private offices, open collaborative areas) when the scene is explicitly set inside the coworking space.',
      'Pay close attention to spatial direction: if someone is entering a building, they should be facing inward toward the lobby with the interior ahead of them, not behind them.',
      `Who is in the scene: ${whoLines}.`,
      `Event context: ${useCase.name}${useCase.description ? ` — ${useCase.description}` : ''}.`,
      'Style: high-end corporate lifestyle photography, warm natural light, candid and authentic, shallow depth of field. No text overlays, no logos, no watermarks.',
    ].join(' ')
    console.log(`[generate-card-image] calling DALL-E 3 with prompt: ${prompt.slice(0, 120)}…`)

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
      console.log(`[generate-card-image] DALL-E responded — url present: ${!!dalleUrl}`)
    } catch (err) {
      console.error('[generate-card-image] DALL-E error:', err)
      return
    }

    if (!dalleUrl) {
      console.error('[generate-card-image] DALL-E returned no URL — aborting')
      return
    }

    let finalUrl = dalleUrl
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        console.log('[generate-card-image] uploading to Vercel Blob…')
        const imageRes = await fetch(dalleUrl)
        if (!imageRes.ok) throw new Error(`Failed to fetch DALL-E image: ${imageRes.status}`)
        const imageBuffer = await imageRes.arrayBuffer()
        const { put } = await import('@vercel/blob')
        const blob = await put(
          `storyboard-cards/${cardId}.png`,
          imageBuffer,
          { access: 'public', contentType: 'image/png', addRandomSuffix: false }
        )
        finalUrl = blob.url
        console.log(`[generate-card-image] Blob upload complete: ${finalUrl}`)
      } catch (err) {
        console.error('[generate-card-image] Blob upload failed — using raw DALL-E URL as fallback:', err)
        // finalUrl remains dalleUrl
      }
    } else {
      console.log('[generate-card-image] BLOB_READ_WRITE_TOKEN not set — using raw DALL-E URL')
    }

    const saved = await saveImageIfLatest(cardId, finalUrl, requestedAt)
    console.log(`[generate-card-image] saveImageIfLatest result: ${saved ? 'saved' : 'superseded by newer request'}`)
  } catch (err) {
    console.error('[generate-card-image] unexpected error:', err)
  }
}
