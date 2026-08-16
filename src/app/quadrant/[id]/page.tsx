import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import {
  getProjectById,
  getThemes,
  getOrCreateParticipant,
  getParticipant,
  getPlacementsForUser,
  getRevealAnalysis,
  getDecidedThemes,
  getDecisionLog,
  type QuadrantKey,
} from '@/lib/db/quadrants'
import { SetupView, type EditableTheme } from './SetupView'
import { AxisSettings } from './AxisSettings'
import { AdminMonitor } from './AdminMonitor'
import { StatusPoller } from './StatusPoller'
import { PlacementActivity, type ActivityTheme } from './PlacementActivity'
import { WaitingView } from './WaitingView'
import { RevealView, type RevealTheme } from './RevealView'

export const dynamic = 'force-dynamic'

function displayName(user: { name?: string | null; email?: string | null }): string {
  return (user.name ?? user.email ?? 'Someone').slice(0, 120)
}

export default async function QuadrantProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const { id } = await params
  const project = await getProjectById(id)
  if (!project) notFound()

  const userId = session.user.userId
  const isAdmin = session.user.role === 'admin'
  const canManage = isAdmin || project.created_by === userId
  const quadrantLabels = project.axisLabels.quadrants

  // ── Setup: facilitator-only ──
  if (project.status === 'setup') {
    if (!canManage) notFound()
    const themes = await getThemes(id)
    const editable: EditableTheme[] = themes.map((t) => ({
      id: t.id,
      title: t.title,
      items: t.items,
      facilitatorReference: t.facilitator_reference,
    }))
    return (
      <main className="min-h-screen bg-canvas">
        <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
          <Link href="/quadrant" className="text-sm text-ink-muted hover:text-ink">← All projects</Link>
          <header className="mt-3 mb-6">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-canvas border border-line text-[11px] font-bold uppercase tracking-widest text-ink-muted mb-2">
              Setup
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-light text-ink tracking-tight">{project.name}</h1>
            <p className="text-ink-soft mt-1">Seed the themes, tune the labels, then start the workshop.</p>
          </header>
          <AxisSettings projectId={id} axisLabels={project.axisLabels} />
          <SetupView projectId={id} name={project.name} initialThemes={editable} quadrantLabels={quadrantLabels} />
        </div>
      </main>
    )
  }

  // ── Reveal: everyone sees the group results ──
  if (project.status === 'reveal') {
    const frozen = project.frozenBoard
    // Once frozen, the "as voted" view is served from the snapshot, not recomputed
    // — that's what makes it permanent. Before freezing it's the live analysis.
    let votedThemes: RevealTheme[]
    let breakdown: Record<string, { displayName: string; quadrantKey: QuadrantKey | null }[]> | undefined

    if (frozen) {
      votedThemes = frozen.themes.map((t) => ({
        id: t.themeId,
        title: t.title,
        items: t.items,
        votesByQuadrant: t.votesByQuadrant,
        totalVotes: t.totalVotes,
        consensusQuadrant: t.consensusQuadrant,
        tie: t.tie,
        agreementScore: t.agreementScore,
        distinctQuadrants: t.distinctQuadrants,
        contested: t.contested,
        facilitatorReference: isAdmin ? t.facilitatorReference : null,
      }))
      breakdown = isAdmin ? frozen.breakdown : undefined
    } else {
      const analysis = await getRevealAnalysis(id)
      votedThemes = analysis.themes.map((tr) => ({
        id: tr.theme.id,
        title: tr.theme.title,
        items: tr.theme.items,
        votesByQuadrant: tr.votesByQuadrant,
        totalVotes: tr.totalVotes,
        consensusQuadrant: tr.consensusQuadrant,
        tie: tr.tie,
        agreementScore: tr.agreementScore,
        distinctQuadrants: tr.distinctQuadrants,
        contested: tr.contested,
        // Facilitator reference is admin-only, and only after reveal.
        facilitatorReference: isAdmin ? tr.theme.facilitator_reference : null,
      }))
      breakdown = isAdmin ? analysis.breakdown : undefined
    }

    // Most contested first — the debate agenda. Themes with no votes sink.
    const disagreement = [...votedThemes].sort((a, b) => {
      if (a.totalVotes === 0 && b.totalVotes === 0) return 0
      if (a.totalVotes === 0) return 1
      if (b.totalVotes === 0) return -1
      return a.agreementScore - b.agreementScore || b.distinctQuadrants - a.distinctQuadrants
    })

    const [decided, decisionLog] = project.frozen_at
      ? await Promise.all([getDecidedThemes(id), getDecisionLog(id)])
      : [[], []]

    // Voted placement per theme, so the decided board can badge what moved.
    const votedQuadrantByThemeId: Record<string, QuadrantKey | null> = {}
    for (const t of votedThemes) votedQuadrantByThemeId[t.id] = t.consensusQuadrant

    return (
      <>
        <StatusPoller projectId={id} currentStatus={project.status} currentUpdatedAt={project.updated_at} />
        {canManage && (
          <div className="max-w-content mx-auto px-5 pt-6">
            <AdminMonitor projectId={id} status="reveal" frozen={!!project.frozen_at} />
            <AxisSettings projectId={id} axisLabels={project.axisLabels} />
          </div>
        )}
        <RevealView
          projectId={id}
          name={project.name}
          axisLabels={project.axisLabels}
          themes={votedThemes}
          disagreement={disagreement}
          breakdown={breakdown}
          isAdmin={isAdmin}
          canManage={canManage}
          frozenAt={project.frozen_at}
          decided={decided}
          decisionLog={decisionLog}
          votedQuadrantByThemeId={votedQuadrantByThemeId}
        />
      </>
    )
  }

  // ── Active ──
  const themes = await getThemes(id)
  const activityThemes: ActivityTheme[] = themes.map((t) => ({ id: t.id, title: t.title, items: t.items }))

  // Everyone can place — the facilitator participates too. Collaborators are
  // registered on view (so the facilitator sees them join); the admin is only
  // counted once they actually place their first theme (registered by the
  // placements route), so an admin who's only facilitating doesn't skew the tally.
  const participant = canManage
    ? await getParticipant(id, userId)
    : await getOrCreateParticipant(id, {
        userId,
        displayName: displayName(session.user),
        role: 'collaborator',
      })
  const placements = await getPlacementsForUser(id, userId)
  const initialPlacements: Record<string, QuadrantKey | null> = {}
  for (const p of placements) initialPlacements[p.theme_id] = p.quadrant_key
  const iAmDone = participant?.status === 'done'

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <Link href="/quadrant" className="text-sm text-ink-muted hover:text-ink">← All projects</Link>
        <header className="mt-3 mb-6">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-accent text-ink text-[11px] font-bold uppercase tracking-widest mb-2">
            {canManage ? 'Live' : 'Place the themes'}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-light text-ink tracking-tight">{project.name}</h1>
          {canManage && (
            <p className="text-ink-soft mt-1">
              Facilitate below — you can also place the {themes.length} themes yourself.
            </p>
          )}
        </header>

        <StatusPoller projectId={id} currentStatus={project.status} currentUpdatedAt={project.updated_at} />

        {canManage && (
          <>
            <AdminMonitor projectId={id} status="active" />
            <AxisSettings projectId={id} axisLabels={project.axisLabels} />
          </>
        )}

        {iAmDone ? (
          <WaitingView projectId={id} />
        ) : (
          <PlacementActivity
            projectId={id}
            themes={activityThemes}
            axisLabels={project.axisLabels}
            initialPlacements={initialPlacements}
          />
        )}
      </div>
    </main>
  )
}
