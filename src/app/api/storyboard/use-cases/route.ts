import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getAllUseCases, getActiveUseCases, createUseCase } from '@/lib/db/storyboard-use-cases'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const useCases = session.user.role === 'admin'
      ? await getAllUseCases()
      : await getActiveUseCases()
    return NextResponse.json({ useCases })
  } catch (error) {
    console.error('[storyboard/use-cases GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const id = `suc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const useCase = await createUseCase({ ...parsed.data, id, created_by: session.user.userId })
    return NextResponse.json({ useCase }, { status: 201 })
  } catch (error) {
    console.error('[storyboard/use-cases POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
