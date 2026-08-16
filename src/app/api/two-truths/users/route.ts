import { NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { getAllUsers } from '@/lib/db/users'

export const GET = route(async () => {
  await requireAdmin()

  const users = await getAllUsers()
  return NextResponse.json({ users })
})
