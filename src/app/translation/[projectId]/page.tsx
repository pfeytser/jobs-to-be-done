import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { isTranslationOwner } from '@/lib/translation/access'
import { getProject, listDatasets } from '@/lib/db/translation'
import { projectLanguages } from '@/lib/translation/entries'
import { Editor } from './Editor'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const { projectId } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  const isOwner = isTranslationOwner(session.user.email)
  const datasets = await listDatasets(projectId)
  const languages = projectLanguages(datasets)

  // Send datasets without their bulky source text — the editor only needs metadata.
  const datasetMeta = datasets.map((d) => ({
    id: d.id,
    kind: d.kind,
    name: d.name,
    config: d.config,
  }))

  return (
    <main className="min-h-screen bg-canvas">
      <Editor
        project={project}
        isOwner={isOwner}
        initialDatasets={datasetMeta}
        initialLanguages={languages}
      />
    </main>
  )
}
