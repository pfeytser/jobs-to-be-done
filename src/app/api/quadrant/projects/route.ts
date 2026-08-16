import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireAdmin, route } from '@/lib/auth/guards'
import {
  getAllProjects,
  getVisibleProjects,
  createProject,
  DEFAULT_AXIS_LABELS,
} from '@/lib/db/quadrants'
import { z } from 'zod'

// Callers may rename the axes/quadrants but the four-quadrant structure is fixed.
const AxisLabelsSchema = z.object({
  horizontalAxis: z.string().min(1).max(80),
  verticalAxis: z.string().min(1).max(80),
  horizontalLeft: z.string().min(1).max(80),
  horizontalRight: z.string().min(1).max(80),
  verticalTop: z.string().min(1).max(80),
  verticalBottom: z.string().min(1).max(80),
  quadrants: z.object({
    table_stakes_floor: z.string().min(1).max(80),
    signature: z.string().min(1).max(80),
    cut_or_defer: z.string().min(1).max(80),
    distinctive_bet: z.string().min(1).max(80),
  }),
})

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  axisLabels: AxisLabelsSchema.optional(),
})

export const GET = route(async () => {
  const user = await requireUser()
  const projects = user.role === 'admin' ? await getAllProjects() : await getVisibleProjects()
  return NextResponse.json({ projects })
})

export const POST = route(async (req: NextRequest) => {
  // Only the admin facilitates: creates projects and drives the states.
  const user = await requireAdmin()

  const parsed = CreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const created = await createProject({
    name: parsed.data.name,
    axisLabels: parsed.data.axisLabels ?? DEFAULT_AXIS_LABELS,
    created_by: user.userId,
    created_by_name: user.name ?? user.email ?? '',
  })
  return NextResponse.json({ project: created }, { status: 201 })
})
