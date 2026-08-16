import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, route } from '@/lib/auth/guards'
import { setSetting } from '@/lib/db/roadmap'

// Upsert the BAU (bugs / tech debt / maintenance) percentage for one quarter.
const SettingSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  quarter: z.number().int().min(1).max(4),
  bau_pct: z.number().min(0).max(0.95),
})

export const PUT = route(async (req: NextRequest) => {
  await requireAdmin()
  const parsed = SettingSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  await setSetting(parsed.data)
  return NextResponse.json({ ok: true })
})
