import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getUseCaseById } from '@/lib/db/storyboard-use-cases'
import { getStoryboard, upsertStoryboard } from '@/lib/db/storyboards'
import { z } from 'zod'

const UpsertSchema = z.object({
  customer_name: z.string().max(200).default(''),
  customer_demographics: z.string().max(1000).default(''),
  company_type: z.string().max(500).default(''),
  customer_role: z.string().max(200).default(''),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const useCase = await getUseCaseById(id)
    if (!useCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const storyboard = await getStoryboard(id, session.user.userId)
    return NextResponse.json({ storyboard })
  } catch (error) {
    console.error('[board GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const useCase = await getUseCaseById(id)
    if (!useCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['create', 'present'].includes(useCase.status) && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (useCase.status === 'present') {
      return NextResponse.json({ error: 'Storyboard is in presentation mode' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = UpsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const boardId = `sb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const storyboard = await upsertStoryboard({
      id: boardId,
      use_case_id: id,
      user_id: session.user.userId,
      ...parsed.data,
    })
    return NextResponse.json({ storyboard })
  } catch (error) {
    console.error('[board PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
