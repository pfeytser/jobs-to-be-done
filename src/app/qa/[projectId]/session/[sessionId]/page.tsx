import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getSessionById } from '@/lib/db/qa-sessions'
import { getTestItemsForSession } from '@/lib/db/qa-test-items'
import { getResultsBySession, getTesterUsernames } from '@/lib/db/qa-results'
import { getQAProjectBySlug } from '@/lib/db/qa-projects'
import { TestChecklist } from '@/components/qa/TestChecklist'

export const dynamic = 'force-dynamic'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ projectId: string; sessionId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const { projectId: slug, sessionId } = await params
  const qaSession = await getSessionById(sessionId)

  if (!qaSession) redirect(`/qa/${slug}`)
  if (session.user.role !== 'admin' && qaSession.tester_id !== session.user.userId) {
    redirect(`/qa/${slug}`)
  }

  const project = await getQAProjectBySlug(slug)
  if (!project) redirect('/qa')

  const [items, results, previousUsernames] = await Promise.all([
    getTestItemsForSession(project.id, qaSession.viewport, qaSession.user_type),
    getResultsBySession(sessionId),
    getTesterUsernames(session.user.userId, project.id),
  ])

  if (items.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <h1 className="text-xl font-bold text-ink mb-2">No test items yet</h1>
        <p className="text-sm text-ink-2 mb-4">
          This project doesn&apos;t have a test suite set up yet. Ask an admin to add test items.
        </p>
        <Link
          href={`/qa/${slug}`}
          className="text-sm text-ink underline hover:opacity-70 transition-opacity"
        >
          Back to project
        </Link>
      </main>
    )
  }

  return (
    <div>
      <TestChecklist
        qaSession={qaSession}
        items={items}
        initialResults={results}
        previousUsernames={previousUsernames}
        setupInstructions={project.user_type_instructions[qaSession.user_type] ?? ''}
        backHref={`/qa/${slug}`}
        backLabel={project.name}
      />
    </div>
  )
}
