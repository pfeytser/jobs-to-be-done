import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getWorkshopById, getItems } from '@/lib/db/workshops'
import { SetupView } from '../SetupView'

export const dynamic = 'force-dynamic'

/** Facilitator-only editing of items after activation (category round). */
export default async function WorkshopEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const { id } = await params
  const workshop = await getWorkshopById(id)
  if (!workshop) notFound()

  const canManage = session.user.role === 'admin' || workshop.created_by === session.user.userId
  if (!canManage) notFound()

  // Draft editing happens on the main page; item edits are locked once the group
  // has moved on to the combined round.
  if (workshop.status === 'draft') redirect(`/workshop/${id}`)
  if (workshop.status !== 'ranking_categories') notFound()

  const items = await getItems(id)
  return (
    <SetupView
      workshopId={id}
      name={workshop.name}
      description={workshop.description}
      mode="live"
      initialItems={items.map((i) => ({ id: i.id, category: i.category, title: i.title, description: i.description }))}
    />
  )
}
