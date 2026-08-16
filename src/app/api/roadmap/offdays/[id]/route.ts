import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { deleteCompanyOffDay } from '@/lib/db/roadmap'

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await params
  await deleteCompanyOffDay(id)
  return NextResponse.json({ ok: true })
})
