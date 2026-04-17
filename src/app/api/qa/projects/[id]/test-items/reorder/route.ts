import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { reorderTestItems } from '@/lib/db/qa-test-items'
import { z } from 'zod'

const ReorderSchema = z.object({ orderedIds: z.array(z.string()) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: projectId } = await params
  try {
    const body = await req.json()
    const parsed = ReorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }
    await reorderTestItems(projectId, parsed.data.orderedIds)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[qa/test-items/reorder POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
