import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getAllSessions, getVotesForSession } from '@/lib/db/two-truths'
import { getAllUsers } from '@/lib/db/users'
import { AdminTwoTruthsClient } from './AdminTwoTruthsClient'

export const dynamic = 'force-dynamic'

export default async function TwoTruthsAdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/two-truths')

  const [sessions, users] = await Promise.all([getAllSessions(), getAllUsers()])
  const counts = await Promise.all(
    sessions.map(async (s) => ({ id: s.id, count: (await getVotesForSession(s.id)).length }))
  )
  const countMap = Object.fromEntries(counts.map((c) => [c.id, c.count]))

  const initialSessions = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    author_name: s.author_name,
    status: s.status,
    created_at: s.created_at,
    votes: countMap[s.id] ?? 0,
  }))

  return (
    <AdminTwoTruthsClient
      initialSessions={initialSessions}
      users={users.map((u) => ({ user_id: u.user_id, name: u.name ?? u.email, email: u.email }))}
    />
  )
}
