import { NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { getRoadmapData } from '@/lib/db/roadmap'

// Bundled read of everything the dashboard needs. Admin-only.
export const GET = route(async () => {
  await requireAdmin()
  const data = await getRoadmapData()
  return NextResponse.json(data)
})
