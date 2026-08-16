import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
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

export const PATCH = route(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) => {
  await requireAdmin()

  const { itemId } = await params
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  const item = await updateTestItem(itemId, parsed.data)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ item })
})

export const DELETE = route(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) => {
  await requireAdmin()

  const { itemId } = await params
  await deleteTestItem(itemId)
  return NextResponse.json({ ok: true })
})
