import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, route } from '@/lib/auth/guards'
import { createCompanyOffDay, listCompanyOffDays } from '@/lib/db/roadmap'

// Company-wide off days (off-sites, all-hands, shutdowns) — team-wide PTO.
const OffDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  label: z.string().max(120).default(''),
})

export const GET = route(async () => {
  await requireAdmin()
  return NextResponse.json({ offDays: await listCompanyOffDays() })
})

export const POST = route(async (req: NextRequest) => {
  await requireAdmin()
  const parsed = OffDaySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  const offDay = await createCompanyOffDay(parsed.data.date, parsed.data.label)
  return NextResponse.json({ offDay }, { status: 201 })
})
