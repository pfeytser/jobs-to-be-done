import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, route } from '@/lib/auth/guards'
import { isTranslationOwner } from '@/lib/translation/access'
import { getProject, renameProject, deleteProject, listDatasets } from '@/lib/db/translation'
import { projectLanguages } from '@/lib/translation/entries'

export const dynamic = 'force-dynamic'

// Project detail: the project, its datasets (with parsed config), and discovered langs.
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  const { id } = await params
  const project = await getProject(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const datasets = await listDatasets(id)
  return NextResponse.json({ project, datasets, languages: projectLanguages(datasets) })
})

const PatchSchema = z.object({ name: z.string().trim().min(1).max(120) })

export const PATCH = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  if (!isTranslationOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  await renameProject(id, parsed.data.name)
  return NextResponse.json({ ok: true })
})

export const DELETE = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  if (!isTranslationOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  await deleteProject(id)
  return NextResponse.json({ ok: true })
})
