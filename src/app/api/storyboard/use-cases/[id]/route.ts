import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getUseCaseById, updateUseCase } from '@/lib/db/storyboard-use-cases'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'create', 'present', 'archive']).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const useCase = await getUseCaseById(id)
    if (!useCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (session.user.role !== 'admin' && !['create', 'present'].includes(useCase.status)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ useCase })
  } catch (error) {
    console.error('[storyboard/use-cases/:id GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const useCase = await updateUseCase(id, parsed.data)
    if (!useCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ useCase })
  } catch (error) {
    console.error('[storyboard/use-cases/:id PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
