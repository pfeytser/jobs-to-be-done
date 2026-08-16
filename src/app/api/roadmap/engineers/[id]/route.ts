import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, route } from '@/lib/auth/guards'
import { deleteEngineer, updateEngineer } from '@/lib/db/roadmap'
import { COUNTRY_META } from '@/lib/roadmap/types'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .nullable()

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  country: z.string().refine((c) => c in COUNTRY_META, 'Unknown country').optional(),
  capacity_fraction: z.number().min(0).max(1).optional(),
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  active: z.union([z.literal(0), z.literal(1)]).optional(),
})

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await params
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  await updateEngineer(id, parsed.data)
  return NextResponse.json({ ok: true })
})

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await params
  await deleteEngineer(id)
  return NextResponse.json({ ok: true })
})
