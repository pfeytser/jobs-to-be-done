import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireAdmin, route } from '@/lib/auth/guards'
import { getUseCaseById, updateUseCase } from '@/lib/db/storyboard-use-cases'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'create', 'present', 'archive']).optional(),
})

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()

  const { id } = await params
  const useCase = await getUseCaseById(id)
  if (!useCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (user.role !== 'admin' && !['create', 'present'].includes(useCase.status)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ useCase })
})

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const useCase = await updateUseCase(id, parsed.data)
  if (!useCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ useCase })
})
