import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getUserProfile, upsertUserProfile } from '@/lib/db/user-profiles'
import { z } from 'zod'

const UpdateSchema = z.object({
  sea_creature: z.string().max(200).optional(),
  sea_creature_why: z.string().max(1000).optional(),
  sea_creature_skipped: z.boolean().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const profile = await getUserProfile(session.user.userId)
    return NextResponse.json({ profile })
  } catch (error) {
    console.error('[profile GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const profile = await upsertUserProfile(session.user.userId, parsed.data)
    return NextResponse.json({ profile })
  } catch (error) {
    console.error('[profile PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
