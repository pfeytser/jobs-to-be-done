import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getUseCaseById } from '@/lib/db/storyboard-use-cases'
import { getStoryboard } from '@/lib/db/storyboards'
import { getCardsForStoryboard } from '@/lib/db/storyboard-cards'
import StoryboardEditor from './StoryboardEditor'
import PresentationMode from './PresentationMode'
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

  // In present mode, expose image_url and generation status; in edit mode, strip both
  const safeCards = cards.map((c) => ({
    ...c,
    image_url: useCase.status === 'present' ? c.image_url : null,
    generation_requested_at: useCase.status === 'present' ? c.generation_requested_at : null,
  }))

  return (
    <div className="min-h-screen bg-canvas">
      {useCase.status === 'present' ? (
        <PresentationMode
          useCase={{ id: useCase.id, name: useCase.name }}
          initialCards={safeCards}
          isAdmin={session.user.role === 'admin'}
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
