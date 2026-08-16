import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getUserProfile, upsertUserProfile } from '@/lib/db/user-profiles'
import { z } from 'zod'

const UpdateSchema = z.object({
  sea_creature: z.string().max(200).optional(),
  sea_creature_why: z.string().max(1000).optional(),
  sea_creature_skipped: z.boolean().optional(),
})

export const GET = route(async () => {
  const user = await requireUser()

  const profile = await getUserProfile(user.userId)
  return NextResponse.json({ profile })
})

export const PUT = route(async (req: NextRequest) => {
  const user = await requireUser()

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const profile = await upsertUserProfile(user.userId, parsed.data)
  return NextResponse.json({ profile })
})
