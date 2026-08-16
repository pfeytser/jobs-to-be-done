import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, route } from '@/lib/auth/guards'
import { isTranslationOwner } from '@/lib/translation/access'
import { listProjects, createProject } from '@/lib/db/translation'

export const dynamic = 'force-dynamic'

// Any logged-in user may list projects.
export const GET = route(async () => {
  await requireUser()
  const projects = await listProjects()
  return NextResponse.json({ projects })
})

const CreateSchema = z.object({ name: z.string().trim().min(1).max(120) })

// Only the owner may create projects.
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  if (!isTranslationOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = CreateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  const project = await createProject(parsed.data.name)
  return NextResponse.json({ project })
})
