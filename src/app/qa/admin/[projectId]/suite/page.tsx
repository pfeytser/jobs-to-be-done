import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getQAProjectBySlug } from '@/lib/db/qa-projects'
import { getTestItemsByProject, getTestItemsByUserType } from '@/lib/db/qa-test-items'
import { TestSuiteEditor } from '@/components/qa/TestSuiteEditor'
import { UserTypeSuiteView } from './UserTypeSuiteView'

export const dynamic = 'force-dynamic'

export default async function SuitePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ userType?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/qa')

  const { projectId } = await params
  const { userType } = await searchParams

  const project = await getQAProjectBySlug(projectId)
  if (!project) redirect('/qa/admin')

  const items = userType
    ? await getTestItemsByUserType(project.id, userType)
    : await getTestItemsByProject(project.id)

  return (
    <main className="max-w-full px-6 py-8">
      <div className="max-w-5xl mx-auto mb-6">
        <Link
          href={`/qa/admin/${projectId}`}
          className="text-xs text-ink-3 hover:text-ink transition-colors"
        >
          ← Back to dashboard
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-ink mb-0.5">
            {userType ?? 'All test items'}
          </h1>
          <p className="text-sm text-ink-3">{project.name}</p>
        </div>
      </div>

      {userType ? (
        <UserTypeSuiteView
          projectId={project.id}
          userType={userType}
          initialItems={items}
          initialInstructions={project.user_type_instructions[userType] ?? ''}
        />
      ) : (
        <TestSuiteEditor projectId={project.id} initialItems={items} />
      )}
    </main>
  )
}
