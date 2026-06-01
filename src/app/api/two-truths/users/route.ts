import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getAllUsers } from '@/lib/db/users'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const users = await getAllUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('[two-truths/users GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
