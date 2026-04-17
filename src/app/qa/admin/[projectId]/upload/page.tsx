import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getQAProjectBySlug } from '@/lib/db/qa-projects'
import { UploadAndEditPage } from './UploadAndEditPage'

export const dynamic = 'force-dynamic'

export default async function UploadPage({
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
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link
          href={`/qa/admin/${projectId}`}
          className="text-xs text-ink-3 hover:text-ink transition-colors"
        >
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2 mb-1">Upload test documents</h1>
        <p className="text-sm text-ink-3">
          Upload CSV, PDF, Word, or Excel files. The AI will read them and build a clean test suite.
          You can edit, reorder, and save before it goes live.
        </p>
      </div>
      <UploadAndEditPage projectId={project.id} projectSlug={projectId} userTypes={project.user_types} />
    </main>
  )
}
