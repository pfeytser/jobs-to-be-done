import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getUseCaseById } from '@/lib/db/storyboard-use-cases'
import { getStoryboard } from '@/lib/db/storyboards'
import { getCardById, updateCard, deleteCard } from '@/lib/db/storyboard-cards'
import { z } from 'zod'

const UpdateSchema = z.object({
  scene_description: z.string().max(5000).optional(),
  sort_order: z.number().int().min(0).optional(),
})

async function verifyOwnership(useCaseId: string, cardId: string, userId: string) {
  const useCase = await getUseCaseById(useCaseId)
  if (!useCase) return { error: 'Not found', status: 404 }
  if (useCase.status === 'present') return { error: 'Storyboard is in presentation mode', status: 403 }

  const storyboard = await getStoryboard(useCaseId, userId)
  if (!storyboard) return { error: 'Not found', status: 404 }

  const card = await getCardById(cardId)
  if (!card || card.storyboard_id !== storyboard.id) return { error: 'Not found', status: 404 }

  return { useCase, storyboard, card }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, cardId } = await params
    const ownership = await verifyOwnership(id, cardId, session.user.userId)
    if ('error' in ownership) return NextResponse.json({ error: ownership.error }, { status: ownership.status })

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const card = await updateCard(cardId, parsed.data)
    return NextResponse.json({ card: card ? { ...card, image_url: undefined } : null })
  } catch (error) {
    console.error('[cards/:cardId PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, cardId } = await params
    const ownership = await verifyOwnership(id, cardId, session.user.userId)
    if ('error' in ownership) return NextResponse.json({ error: ownership.error }, { status: ownership.status })

    await deleteCard(cardId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[cards/:cardId DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
