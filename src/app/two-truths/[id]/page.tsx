import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import {
  getSessionById,
  getStatements,
  getStatementsForDisplay,
  getVoteForUser,
  getVotesForSession,
} from '@/lib/db/two-truths'
import { AuthorSetup } from './AuthorSetup'
import { VotingView } from './VotingView'
import { WaitingView } from './WaitingView'
import { ResultsView } from './ResultsView'
import { StatusPoller } from './StatusPoller'

export const dynamic = 'force-dynamic'

export default async function TwoTruthsSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const { id } = await params
  const game = await getSessionById(id)
  if (!game) notFound()

  const userId = session.user.userId
  const isAdmin = session.user.role === 'admin'
  const isAuthor = game.author_id === userId

  // ── Draft: only the assigned author may set up their statements ──
  if (game.status === 'draft') {
    if (!isAuthor) notFound()
    const statements = await getStatements(id)
    return (
      <AuthorSetup
        sessionId={id}
        title={game.title}
        initial={statements.map((s) => ({ position: s.position, text: s.text, is_lie: s.is_lie }))}
      />
    )
  }

  // ── Archived: admin-only review ──
  if (game.status === 'archived' && !isAdmin) notFound()

  // ── Active: vote, or wait ──
  if (game.status === 'active') {
    const display = await getStatementsForDisplay(id)
    const vote = await getVoteForUser(id, userId)
    const safeStatements = display.map((s) => ({ id: s.id, text: s.text }))

    if (isAuthor) {
      return (
        <>
          <StatusPoller sessionId={id} currentStatus={game.status} />
          <WaitingView title={game.title} authorName={game.author_name} isAuthor statements={safeStatements} />
        </>
      )
    }
    if (vote) {
      return (
        <>
          <StatusPoller sessionId={id} currentStatus={game.status} />
          <WaitingView
            title={game.title}
            authorName={game.author_name}
            isAuthor={false}
            guessedStatementId={vote.statement_id}
            statements={safeStatements}
          />
        </>
      )
    }
    return (
      <>
        <StatusPoller sessionId={id} currentStatus={game.status} />
        <VotingView
          sessionId={id}
          title={game.title}
          authorName={game.author_name}
          statements={safeStatements}
        />
      </>
    )
  }

  // ── Completed / Archived(admin): full results ──
  const [display, votes] = await Promise.all([getStatementsForDisplay(id), getVotesForSession(id)])
  const vote = await getVoteForUser(id, userId)
  const resultStatements = display.map((s) => {
    const cast = votes.filter((v) => v.statement_id === s.id)
    return {
      id: s.id,
      text: s.text,
      is_lie: s.is_lie,
      votes: cast.length,
      voters: cast.map((v) => v.voter_name),
    }
  })

  return (
    <ResultsView
      title={game.title}
      authorName={game.author_name}
      statements={resultStatements}
      totalVotes={votes.length}
      viewerVoted={!!vote}
      viewerGuessId={vote?.statement_id ?? null}
      isAuthor={isAuthor}
    />
  )
}
