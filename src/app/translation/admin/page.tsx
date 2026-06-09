import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { isTranslationOwner } from '@/lib/translation/access'
import { listProjects } from '@/lib/db/translation'
import { AdminClient } from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function TranslationAdmin() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  // Setup is owner-only. Everyone else is sent to the work surface.
  if (!isTranslationOwner(session.user.email)) redirect('/translation')

  const projects = await listProjects()
  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <AdminClient initialProjects={projects} />
      </div>
    </main>
  )
}
