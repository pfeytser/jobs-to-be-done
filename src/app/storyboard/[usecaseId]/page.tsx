import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { getUseCaseById } from '@/lib/db/storyboard-use-cases'
import { getStoryboard } from '@/lib/db/storyboards'
import { getCardsForStoryboard } from '@/lib/db/storyboard-cards'
import StoryboardEditor from './StoryboardEditor'
import PresentationMode from './PresentationMode'
import { AdminNav } from '@/components/AdminNav'

export const dynamic = 'force-dynamic'

export default async function StoryboardUseCasePage({
  params,
}: {
  params: Promise<{ usecaseId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const { usecaseId } = await params
  const useCase = await getUseCaseById(usecaseId)

  if (!useCase) notFound()

  // Collaborators can't see draft/archive
  if (
    session.user.role !== 'admin' &&
    !['create', 'present'].includes(useCase.status)
  ) {
    notFound()
  }

  const storyboard = await getStoryboard(usecaseId, session.user.userId)
  const cards = storyboard ? await getCardsForStoryboard(storyboard.id) : []

  // In present mode, expose image_url; in edit mode, strip it
  const safeCards = cards.map((c) => ({
    ...c,
    image_url: useCase.status === 'present' ? c.image_url : null,
  }))

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-warm-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/storyboard" className="text-ink-3 hover:text-ink transition-colors text-sm shrink-0">
              ← Storyboard
            </Link>
            <span className="text-ink-3 shrink-0">/</span>
            <span className="font-semibold text-ink truncate">{useCase.name}</span>
          </div>
          <AdminNav role={session.user.role} />
        </div>
      </header>

      {useCase.status === 'present' ? (
        <PresentationMode
          useCase={{ id: useCase.id, name: useCase.name }}
          initialCards={safeCards}
        />
      ) : (
        <StoryboardEditor
          useCase={{ id: useCase.id, name: useCase.name, description: useCase.description }}
          initialStoryboard={storyboard}
          initialCards={safeCards}
        />
      )}
    </div>
  )
}
