import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getWorkshopById, updateItem, deleteItem } from '@/lib/db/workshops'
import { z } from 'zod'

const UpdateSchema = z.object({
  category: z.string().min(1).max(120),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().default(''),
})

function canManage(user: { role: string; userId: string }, createdBy: string): boolean {
  return user.role === 'admin' || createdBy === user.userId
}

export const PATCH = route(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) => {
    const user = await requireUser()
    const { id, itemId } = await params
    const workshop = await getWorkshopById(id)
    if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canManage(user, workshop.created_by)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (workshop.status !== 'draft') {
      return NextResponse.json({ error: 'Items can only be edited while the workshop is in draft' }, { status: 409 })
    }
    const parsed = UpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }
    await updateItem(id, itemId, parsed.data)
    return NextResponse.json({ ok: true })
  }
)

export const DELETE = route(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) => {
    const user = await requireUser()
    const { id, itemId } = await params
    const workshop = await getWorkshopById(id)
    if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canManage(user, workshop.created_by)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (workshop.status !== 'draft') {
      return NextResponse.json({ error: 'Items can only be edited while the workshop is in draft' }, { status: 409 })
    }
    await deleteItem(id, itemId)
    return NextResponse.json({ ok: true })
  }
)
