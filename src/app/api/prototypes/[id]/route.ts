import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { getPrototypeById, updatePrototypeMeta, deletePrototype } from '@/lib/db/prototypes'
import { deletePrototypeBlob } from '@/lib/prototypes/storage'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'archived']).optional(),
})

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()

  const { id } = await params
  const prototype = await getPrototypeById(id)
  if (!prototype) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ prototype })
})

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  const prototype = await updatePrototypeMeta(id, parsed.data)
  if (!prototype) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ prototype })
})

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()

  const { id } = await params
  const prototype = await getPrototypeById(id)
  if (!prototype) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await deletePrototypeBlob(prototype.blob_pathname)
  await deletePrototype(id)
  return NextResponse.json({ ok: true })
})
