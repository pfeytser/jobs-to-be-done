import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireAdmin, route } from '@/lib/auth/guards'
import { getAllUseCases, getActiveUseCases, createUseCase } from '@/lib/db/storyboard-use-cases'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
})

export const GET = route(async () => {
  const user = await requireUser()

  const useCases = user.role === 'admin'
    ? await getAllUseCases()
    : await getActiveUseCases()
  return NextResponse.json({ useCases })
})

export const POST = route(async (req: NextRequest) => {
  const user = await requireAdmin()

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const id = `suc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const useCase = await createUseCase({ ...parsed.data, id, created_by: user.userId })
  return NextResponse.json({ useCase }, { status: 201 })
})
