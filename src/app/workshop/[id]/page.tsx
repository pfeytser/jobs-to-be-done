import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import {
  getWorkshopById,
  getItems,
  getCombinedItemIds,
  getOrSeedUserRankings,
  getCombinedResults,
  getCategoryResults,
  categoriesOf,
  phaseForStatus,
  type WorkshopItem,
} from '@/lib/db/workshops'
import { SetupView } from './SetupView'
import { RankingBoard, type BoardColumn } from './RankingBoard'
import { WaitingView } from './WaitingView'
import { ResultsView, type ResultRow } from './ResultsView'
import { StatusPoller } from './StatusPoller'
import { AdminControls } from './AdminControls'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  ranking_categories: 'Round 1 · rank each category',
  ranking_combined: 'Round 2 · rank the combined list',
}

export default async function WorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const { id } = await params
  const workshop = await getWorkshopById(id)
  if (!workshop) notFound()

  const userId = session.user.userId
  const isAdmin = session.user.role === 'admin'
  const canManage = isAdmin || workshop.created_by === userId

  // ── Draft: facilitator-only setup ──
  if (workshop.status === 'draft') {
    if (!canManage) notFound()
    const items = await getItems(id)
    return (
      <SetupView
        workshopId={id}
        name={workshop.name}
        description={workshop.description}
        mode="draft"
        initialItems={items.map((i) => ({ id: i.id, category: i.category, title: i.title, description: i.description }))}
      />
    )
  }

  // ── Revealed / Archived: read-only results ──
  if (workshop.status === 'revealed' || workshop.status === 'archived') {
    if (workshop.status === 'archived' && !isAdmin) notFound()
    const [combinedRanked, categoryRanked] = await Promise.all([
      getCombinedResults(id),
      getCategoryResults(id),
    ])
    const toRow = (r: { rank: number; score: number; item: WorkshopItem }): ResultRow => ({
      rank: r.rank,
      score: r.score,
      title: r.item.title,
      description: r.item.description,
      category: r.item.category,
    })
    return (
      <>
        {canManage && (
          <div className="max-w-content mx-auto px-5 pt-6">
            <AdminControls workshopId={id} status={workshop.status} />
          </div>
        )}
        <StatusPoller workshopId={id} currentStatus={workshop.status} currentUpdatedAt={workshop.updated_at} />
        <ResultsView
          name={workshop.name}
          description={workshop.description}
          archived={workshop.status === 'archived'}
          combined={combinedRanked.map(toRow)}
          categories={categoryRanked.map((c) => ({ category: c.category, rows: c.ranked.map(toRow) }))}
        />
      </>
    )
  }

  // ── Live ranking rounds ──
  const phase = phaseForStatus(workshop.status)!
  const items = await getItems(id)
  const itemMap = new Map(items.map((i) => [i.id, i]))

  const rankings = await getOrSeedUserRankings(
    id,
    { userId, name: session.user.name ?? session.user.email ?? '', email: session.user.email ?? '' },
    phase
  )
  const mySubmitted = rankings.length > 0 && rankings.every((r) => r.submitted)

  const toCards = (ids: string[]) =>
    ids
      .map((cid) => itemMap.get(cid))
      .filter((it): it is WorkshopItem => Boolean(it))
      .map((it) => ({ id: it.id, title: it.title, description: it.description, category: it.category }))

  let columns: BoardColumn[]
  if (phase === 'categories') {
    const orderByCategory = new Map(rankings.map((r) => [r.category, r.ordered_item_ids]))
    columns = categoriesOf(items).map((category) => ({
      category,
      label: category,
      cards: toCards(orderByCategory.get(category) ?? items.filter((i) => i.category === category).map((i) => i.id)),
    }))
  } else {
    const combinedIds = await getCombinedItemIds(id)
    const order = rankings[0]?.ordered_item_ids ?? combinedIds
    columns = [{ category: '', label: '', cards: toCards(order) }]
  }

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-5 py-8 sm:py-12">
        <Link href="/workshop" className="text-sm text-ink-muted hover:text-ink">← All workshops</Link>
        <header className="mt-3 mb-6">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-canvas border border-line text-[11px] font-bold uppercase tracking-widest text-ink-muted mb-2">
            {STATUS_LABEL[workshop.status]}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-light text-ink tracking-tight">{workshop.name}</h1>
          {workshop.description && <p className="text-ink-soft mt-1">{workshop.description}</p>}
        </header>

        <StatusPoller workshopId={id} currentStatus={workshop.status} currentUpdatedAt={workshop.updated_at} />
        {canManage && <AdminControls workshopId={id} status={workshop.status} />}

        {mySubmitted ? (
          <WaitingView workshopId={id} roundLabel={phase === 'categories' ? 'category' : 'combined'} />
        ) : (
          <RankingBoard workshopId={id} columns={columns} combined={phase === 'combined'} />
        )}
      </div>
    </main>
  )
}
