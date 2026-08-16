import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, route } from '@/lib/auth/guards'
import { getProjectById, getRevealAnalysis, getDecidedThemes, getDecisionLog } from '@/lib/db/quadrants'

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Per-theme reveal tally as CSV. Admin-only (includes the facilitator reference). */
export const GET = route(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const labels = project.axisLabels.quadrants
  const analysis = await getRevealAnalysis(id)

  const header = [
    'Theme',
    'Total votes',
    labels.table_stakes_floor,
    labels.signature,
    labels.cut_or_defer,
    labels.distinctive_bet,
    'Consensus',
    'Agreement %',
    'Distinct quadrants',
    'Contested',
    'Facilitator reference',
  ]

  const rows = analysis.themes.map((t) => [
    t.theme.title,
    t.totalVotes,
    t.votesByQuadrant.table_stakes_floor,
    t.votesByQuadrant.signature,
    t.votesByQuadrant.cut_or_defer,
    t.votesByQuadrant.distinctive_bet,
    t.tie ? 'Tie' : t.consensusQuadrant ? labels[t.consensusQuadrant] : '—',
    Math.round(t.agreementScore * 100),
    t.distinctQuadrants,
    t.contested ? 'yes' : 'no',
    t.theme.facilitator_reference ? labels[t.theme.facilitator_reference] : '',
  ])

  const tables: (string | number)[][][] = [[header, ...rows]]

  // Once frozen, the export carries both states: the vote above, then the decided
  // board and how it drifted. Two tables in one file so a spreadsheet shows both.
  if (project.frozen_at) {
    const [decided, log] = await Promise.all([getDecidedThemes(id), getDecisionLog(id, 500)])
    const votedQuadrant = new Map(analysis.themes.map((t) => [t.theme.id, t.consensusQuadrant]))
    const q = (k: typeof analysis.themes[number]['consensusQuadrant']) => (k ? labels[k] : '—')

    tables.push([
      ['Decided board', `frozen ${project.frozen_at}`],
      ['Theme', 'Quadrant', 'Features in scope', 'Origin', 'Voted quadrant', 'Changed', 'Split from'],
      ...decided.map((t) => {
        const voted = t.sourceThemeId ? (votedQuadrant.get(t.sourceThemeId) ?? null) : null
        const moved = t.origin === 'workshop' && voted !== t.quadrantKey
        return [
          t.title,
          q(t.quadrantKey),
          t.items.join(' | '),
          t.origin === 'discussion' ? 'Added in discussion' : 'From the workshop',
          t.origin === 'discussion' ? '—' : q(voted),
          moved ? 'moved' : '',
          t.derivedFromTitle ?? '',
        ]
      }),
    ])

    tables.push([
      ['Change log'],
      ['When', 'Who', 'Change', 'Theme', 'From', 'To', 'Note'],
      ...log.map((e) => [
        e.createdAt,
        e.actorName,
        e.kind,
        e.themeTitle,
        q(e.fromQuadrant),
        q(e.toQuadrant),
        e.note,
      ]),
    ])
  }

  const csv = tables.map((t) => t.map((r) => r.map(csvCell).join(',')).join('\n')).join('\n\n')
  const safeName = project.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'workshop'

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}-reveal.csv"`,
    },
  })
})
