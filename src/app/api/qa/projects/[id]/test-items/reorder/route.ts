import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { reorderTestItems } from '@/lib/db/qa-test-items'
import { z } from 'zod'

const ReorderSchema = z.object({ orderedIds: z.array(z.string()) })

export const POST = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()

  const { id: projectId } = await params
  const body = await req.json()
  const parsed = ReorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  await reorderTestItems(projectId, parsed.data.orderedIds)
  return NextResponse.json({ ok: true })
})
