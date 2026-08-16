import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, route } from '@/lib/auth/guards'
import { createEngineer, listEngineers } from '@/lib/db/roadmap'
import { COUNTRY_META } from '@/lib/roadmap/types'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .nullable()

const EngineerSchema = z.object({
  name: z.string().min(1).max(120),
  country: z.string().refine((c) => c in COUNTRY_META, 'Unknown country'),
  capacity_fraction: z.number().min(0).max(1),
  start_date: isoDate.optional().default(null),
  end_date: isoDate.optional().default(null),
  active: z.union([z.literal(0), z.literal(1)]).default(1),
})

export const GET = route(async () => {
  await requireAdmin()
  return NextResponse.json({ engineers: await listEngineers() })
})

export const POST = route(async (req: NextRequest) => {
  await requireAdmin()
  const parsed = EngineerSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  const engineer = await createEngineer(parsed.data)
  return NextResponse.json({ engineer }, { status: 201 })
})
