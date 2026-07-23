import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import {
  getWorkshopById,
  getDimensionResults,
  getCategoryResults,
  getCombinedResults,
} from '@/lib/db/workshops'

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workshop'
}

function escapeCSV(val: unknown): string {
  if (val == null) return ''
  let s = String(val)
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const toRow = (cols: unknown[]) => cols.map(escapeCSV).join(',')

export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const workshop = await getWorkshopById(id)
  if (!workshop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mirror the reveal page's visibility: results are public once revealed;
  // archived workshops are admin-only.
  const isAdmin = user.role === 'admin'
  if (workshop.status === 'archived' && !isAdmin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (workshop.status !== 'revealed' && workshop.status !== 'archived') {
    return NextResponse.json({ error: 'Results are not revealed yet' }, { status: 409 })
  }

  const rows: string[] = []

  if (workshop.mode === 'multi') {
    const results = await getDimensionResults(id)
    const stick = results.rankDimension?.name ?? 'Stickiness'
    const diff = results.choiceDimension?.name ?? 'Differentiation'
    const options = results.choiceDimension?.options ?? []
    const labelByKey = new Map(options.map((o) => [o.key, o.label]))

    rows.push(
      toRow([
        'Category',
        'Item',
        'Description',
        `${stick} rank`,
        `${stick} score`,
        `${diff} average`,
        `${diff} label`,
        ...options.map((o) => `${o.label} votes`),
        `${diff} voters`,
      ])
    )
    for (const cat of results.categories) {
      for (const it of cat.items) {
        rows.push(
          toRow([
            cat.category,
            it.item.title,
            it.item.description,
            it.stickinessRank || '',
            it.stickinessScore,
            it.diffMean != null ? it.diffMean.toFixed(2) : '',
            it.diffLabel ? labelByKey.get(it.diffLabel) ?? it.diffLabel : '',
            ...options.map((o) => it.diffCounts[o.key] ?? 0),
            it.diffVotes,
          ])
        )
      }
    }
  } else {
    const [categoryResults, combined] = await Promise.all([getCategoryResults(id), getCombinedResults(id)])
    const combinedByItem = new Map(combined.map((r) => [r.item.id, r]))
    rows.push(
      toRow(['Category', 'Item', 'Description', 'Category rank', 'Category score', 'Combined rank', 'Combined score'])
    )
    for (const cat of categoryResults) {
      for (const r of cat.ranked) {
        const c = combinedByItem.get(r.item.id)
        rows.push(
          toRow([cat.category, r.item.title, r.item.description, r.rank, r.score, c?.rank ?? '', c?.score ?? ''])
        )
      }
    }
  }

  const csv = rows.join('\n')
  const filename = `${slugify(workshop.name)}-results-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
