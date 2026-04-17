import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getQAProjectBySlug } from '@/lib/db/qa-projects'
import { EditProjectForm } from './EditProjectForm'

export const dynamic = 'force-dynamic'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/qa')

  const { projectId } = await params
  const project = await getQAProjectBySlug(projectId)
  if (!project) redirect('/qa/admin')

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link
          href={`/qa/admin/${projectId}`}
          className="text-xs text-ink-3 hover:text-ink transition-colors"
        >
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2 mb-1">Edit project</h1>
      </div>
      <div className="bg-surface border border-warm-border rounded-[14px] p-6">
        <EditProjectForm project={project} />
      </div>
    </main>
  )
}
