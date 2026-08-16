import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, route } from '@/lib/auth/guards'
import { setPto } from '@/lib/db/roadmap'

// Upsert a single engineer/quarter PTO cell (days = 0 clears it).
const PtoSchema = z.object({
  engineer_id: z.string().min(1).max(80),
  year: z.number().int().min(2020).max(2100),
  quarter: z.number().int().min(1).max(4),
  days: z.number().min(0).max(65),
})

export const PUT = route(async (req: NextRequest) => {
  await requireAdmin()
  const parsed = PtoSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  await setPto(parsed.data)
  return NextResponse.json({ ok: true })
})
