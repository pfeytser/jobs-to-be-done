import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getPrototypeById, updatePrototypeMeta, deletePrototype } from '@/lib/db/prototypes'
import { deletePrototypeBlob } from '@/lib/prototypes/storage'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'archived']).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  try {
    const prototype = await getPrototypeById(id)
    if (!prototype) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ prototype })
  } catch (error) {
    console.error('[prototypes/:id GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  try {
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }
    const prototype = await updatePrototypeMeta(id, parsed.data)
    if (!prototype) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ prototype })
  } catch (error) {
    console.error('[prototypes/:id PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  try {
    const prototype = await getPrototypeById(id)
    if (!prototype) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await deletePrototypeBlob(prototype.blob_pathname)
    await deletePrototype(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[prototypes/:id DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
