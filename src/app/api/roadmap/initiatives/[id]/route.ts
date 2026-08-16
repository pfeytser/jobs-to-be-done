import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { deleteInitiative, updateInitiative } from '@/lib/db/roadmap'
import { InitiativeSchema } from '@/lib/roadmap/schemas'

// All fields optional on PATCH (partial update); reuses the create schema shape.
const PatchSchema = InitiativeSchema.partial()

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await params
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  await updateInitiative(id, parsed.data)
  return NextResponse.json({ ok: true })
})

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await params
  await deleteInitiative(id)
  return NextResponse.json({ ok: true })
})
