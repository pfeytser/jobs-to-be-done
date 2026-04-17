import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { updateTestItem, deleteTestItem } from '@/lib/db/qa-test-items'
import { z } from 'zod'

const UpdateSchema = z.object({
  tc_number: z.string().optional(),
  part: z.string().optional(),
  section: z.string().optional(),
  feature_area: z.string().optional(),
  platform: z.string().optional(),
  user_type: z.string().optional(),
  test_description: z.string().optional(),
  steps: z.string().optional(),
  expected_result: z.string().optional(),
  jira_reference: z.string().optional(),
  needs_review: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { itemId } = await params
  try {
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }
    const item = await updateTestItem(itemId, parsed.data)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    console.error('[qa/test-items/:itemId PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { itemId } = await params
  try {
    await deleteTestItem(itemId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[qa/test-items/:itemId DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
