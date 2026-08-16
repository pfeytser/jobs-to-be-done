import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { createInitiative, listInitiatives } from '@/lib/db/roadmap'
import { InitiativeSchema } from '@/lib/roadmap/schemas'

export const GET = route(async () => {
  await requireAdmin()
  return NextResponse.json({ initiatives: await listInitiatives() })
})

export const POST = route(async (req: NextRequest) => {
  await requireAdmin()
  const parsed = InitiativeSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  const initiative = await createInitiative(parsed.data)
  return NextResponse.json({ initiative }, { status: 201 })
})
