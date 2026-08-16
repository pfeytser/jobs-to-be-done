import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, route } from '@/lib/auth/guards'
import { createScenario, listScenarios } from '@/lib/db/roadmap'

// A scenario snapshot is an opaque JSON object rehydrated client-side. Bound its
// serialized size rather than validating the full shape.
const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  data: z.record(z.string(), z.unknown()),
})

const MAX_DATA_BYTES = 1_000_000

export const GET = route(async () => {
  await requireAdmin()
  return NextResponse.json({ scenarios: await listScenarios() })
})

export const POST = route(async (req: NextRequest) => {
  await requireAdmin()
  const parsed = CreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }
  if (JSON.stringify(parsed.data.data).length > MAX_DATA_BYTES) {
    return NextResponse.json({ error: 'Scenario too large' }, { status: 413 })
  }
  const scenario = await createScenario(parsed.data.name, parsed.data.data)
  return NextResponse.json({ scenario }, { status: 201 })
})
