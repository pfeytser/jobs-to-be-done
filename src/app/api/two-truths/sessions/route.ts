import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getAllSessions, getVisibleSessions, createSession } from '@/lib/db/two-truths'
import { getUserById } from '@/lib/db/users'
import { z } from 'zod'

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  authorId: z.string().min(1),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const sessions =
      session.user.role === 'admin' ? await getAllSessions() : await getVisibleSessions()
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('[two-truths/sessions GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const parsed = CreateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const author = await getUserById(parsed.data.authorId)
    if (!author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 400 })
    }

    const id = `tt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const created = await createSession({
      id,
      title: parsed.data.title,
      author_id: author.user_id,
      author_name: author.name ?? author.email,
      author_email: author.email,
      created_by: session.user.userId,
    })
    return NextResponse.json({ session: created }, { status: 201 })
  } catch (error) {
    console.error('[two-truths/sessions POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
