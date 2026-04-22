import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getUseCaseById } from '@/lib/db/storyboard-use-cases'
import { getStoryboard } from '@/lib/db/storyboards'
import { getCardsForStoryboard, createCard } from '@/lib/db/storyboard-cards'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const storyboard = await getStoryboard(id, session.user.userId)
    if (!storyboard) return NextResponse.json({ cards: [] })

    const allCards = await getCardsForStoryboard(storyboard.id)
    // Strip image_url from response — it's secret until presentation mode
    // (allow explicit reveal=true query param for polling after retry)
    const useCase = await getUseCaseById(id)
    const forceReveal = req.nextUrl.searchParams.get('reveal') === 'true'
    const reveal = useCase?.status === 'present' || forceReveal
    const cards = allCards.map((c) => ({
      ...c,
      image_url: reveal ? c.image_url : undefined,
      generation_requested_at: reveal ? c.generation_requested_at : undefined,
    }))
    return NextResponse.json({ cards })
  } catch (error) {
    console.error('[cards GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const useCase = await getUseCaseById(id)
    if (!useCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (useCase.status === 'present') {
      return NextResponse.json({ error: 'Storyboard is in presentation mode' }, { status: 403 })
    }

    const storyboard = await getStoryboard(id, session.user.userId)
    if (!storyboard) return NextResponse.json({ error: 'Create customer profile first' }, { status: 400 })

    const existingCards = await getCardsForStoryboard(storyboard.id)
    const nextOrder = existingCards.length > 0
      ? Math.max(...existingCards.map((c) => c.sort_order)) + 1
      : 0

    const cardId = `sbc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const card = await createCard({ id: cardId, storyboard_id: storyboard.id, sort_order: nextOrder })
    return NextResponse.json({ card: { ...card, image_url: undefined } }, { status: 201 })
  } catch (error) {
    console.error('[cards POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
