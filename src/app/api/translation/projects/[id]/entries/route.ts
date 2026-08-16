import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { getProject, listDatasets, getEditsForLang } from '@/lib/db/translation'
import { buildEntries } from '@/lib/translation/entries'

export const dynamic = 'force-dynamic'

// Merged entry list for one language across all datasets in the project.
export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  const { id } = await params
  const lang = req.nextUrl.searchParams.get('lang')
  if (!lang) return NextResponse.json({ error: 'lang is required' }, { status: 400 })

  const project = await getProject(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [datasets, edits] = await Promise.all([listDatasets(id), getEditsForLang(id, lang)])
  const entries = buildEntries(datasets, lang, edits)
  return NextResponse.json({ entries })
})
