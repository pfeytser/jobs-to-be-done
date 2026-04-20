import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getTestItemsByProject, getTestItemsByUserType, createTestItem, deleteTestItemsByProject, deleteTestItemsByUserType, bulkCreateTestItems } from '@/lib/db/qa-test-items'
import { z } from 'zod'

const CreateSchema = z.object({
  tc_number: z.string().default(''),
  part: z.string().default(''),
  section: z.string().default(''),
  feature_area: z.string().default(''),
  platform: z.string().default(''),
  viewport: z.string().default(''),
  user_type: z.string().default(''),
  test_description: z.string().default(''),
  steps: z.string().default(''),
  expected_result: z.string().default(''),
  jira_reference: z.string().default(''),
  needs_review: z.boolean().default(false),
  sort_order: z.number().int().default(0),
})

const BulkSaveSchema = z.object({
  items: z.array(CreateSchema),
  replace: z.boolean().default(false),
  user_type: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const items = await getTestItemsByProject(id)
    return NextResponse.json({ items })
  } catch (error) {
    console.error('[qa/test-items GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: projectId } = await params
  try {
    const body = await req.json()

    // Bulk save (replace all items)
    if (body.items !== undefined) {
      const parsed = BulkSaveSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
      }
      if (parsed.data.replace) {
        if (parsed.data.user_type) {
          await deleteTestItemsByUserType(projectId, parsed.data.user_type)
        } else {
          await deleteTestItemsByProject(projectId)
        }
      }
      await bulkCreateTestItems(projectId, parsed.data.items.map((item, i) => ({
        ...item,
        sort_order: i,
      })))
      const items = parsed.data.user_type
        ? await getTestItemsByUserType(projectId, parsed.data.user_type)
        : await getTestItemsByProject(projectId)
      return NextResponse.json({ items }, { status: 201 })
    }

    // Single item create
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }
    const id = `ti_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const item = await createTestItem({ ...parsed.data, id, project_id: projectId })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('[qa/test-items POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
