import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { isTranslationOwner } from '@/lib/translation/access'
import { listProjects } from '@/lib/db/translation'
import { ProjectsClient } from './ProjectsClient'

export const dynamic = 'force-dynamic'

export default async function TranslationHome() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const isOwner = isTranslationOwner(session.user.email)
  const projects = await listProjects()

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-content mx-auto px-6 py-10">
        <ProjectsClient initialProjects={projects} isOwner={isOwner} />
      </div>
    </main>
  )
}
