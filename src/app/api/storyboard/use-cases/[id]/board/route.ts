import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getUseCaseById } from '@/lib/db/storyboard-use-cases'
import { getStoryboard, upsertStoryboard } from '@/lib/db/storyboards'
import { z } from 'zod'

const UpsertSchema = z.object({
  customer_name: z.string().max(200).default(''),
  customer_demographics: z.string().max(1000).default(''),
  company_type: z.string().max(500).default(''),
  customer_role: z.string().max(200).default(''),
})

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id } = await params
  const useCase = await getUseCaseById(id)
  if (!useCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const storyboard = await getStoryboard(id, user.userId)
  return NextResponse.json({ storyboard })
})

export const PUT = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id } = await params
  const useCase = await getUseCaseById(id)
  if (!useCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['create', 'present'].includes(useCase.status) && user.role !== 'admin') {
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
    user_id: user.userId,
    ...parsed.data,
  })
  return NextResponse.json({ storyboard })
})
