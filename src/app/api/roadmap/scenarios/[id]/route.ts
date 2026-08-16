import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, route } from '@/lib/auth/guards'
import { deleteScenario, getScenario, updateScenario } from '@/lib/db/roadmap'

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const MAX_DATA_BYTES = 1_000_000

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await params
  const scenario = await getScenario(id)
  if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ scenario })
})

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await params
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  if (parsed.data.data && JSON.stringify(parsed.data.data).length > MAX_DATA_BYTES) {
    return NextResponse.json({ error: 'Scenario too large' }, { status: 413 })
  }
  await updateScenario(id, parsed.data)
  return NextResponse.json({ ok: true })
})

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await params
  await deleteScenario(id)
  return NextResponse.json({ ok: true })
})
