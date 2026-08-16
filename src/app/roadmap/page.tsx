import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getRoadmapData } from '@/lib/db/roadmap'
import { RoadmapClient } from './RoadmapClient'

export const dynamic = 'force-dynamic'

// Admin-only Roadmap & Capacity dashboard. Middleware already blocks non-admins
// from /roadmap; this is defense-in-depth plus the data load.
export default async function RoadmapPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/')

  const data = await getRoadmapData()

  return <RoadmapClient initial={data} />
}
