import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { isTranslationOwner } from '@/lib/translation/access'
import { getProject, listDatasets } from '@/lib/db/translation'
import { SetupClient } from './SetupClient'

export const dynamic = 'force-dynamic'

export default async function ProjectSetupPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (!isTranslationOwner(session.user.email)) redirect('/translation')

  const { projectId } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  const datasets = await listDatasets(projectId)
  const datasetMeta = datasets.map((d) => ({ id: d.id, kind: d.kind, name: d.name, config: d.config }))

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-wide mx-auto px-6 py-10">
        <SetupClient project={project} initialDatasets={datasetMeta} />
      </div>
    </main>
  )
}
