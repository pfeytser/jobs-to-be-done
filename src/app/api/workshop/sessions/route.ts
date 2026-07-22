import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireAdmin, route } from '@/lib/auth/guards'
import { getAllWorkshops, getVisibleWorkshops, createWorkshop } from '@/lib/db/workshops'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  topN: z.number().int().min(1).max(10).optional().default(2),
})

export const GET = route(async () => {
  const user = await requireUser()
  const workshops = user.role === 'admin' ? await getAllWorkshops() : await getVisibleWorkshops()
  return NextResponse.json({ workshops })
})

export const POST = route(async (req: NextRequest) => {
  // Only the admin facilitates workshops (creates them and drives the states).
  const user = await requireAdmin()

  const parsed = CreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const created = await createWorkshop({
    id,
    name: parsed.data.name,
    description: parsed.data.description,
    top_n: parsed.data.topN,
    created_by: user.userId,
    created_by_name: user.name ?? user.email ?? '',
  })
  return NextResponse.json({ workshop: created }, { status: 201 })
})
