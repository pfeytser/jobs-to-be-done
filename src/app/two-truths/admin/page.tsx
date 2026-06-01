import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getAllSessions, getVotesForSession, getStatements } from '@/lib/db/two-truths'
import { getAllUsers } from '@/lib/db/users'
import { AdminTwoTruthsClient } from './AdminTwoTruthsClient'

export const dynamic = 'force-dynamic'

export default async function TwoTruthsAdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/two-truths')

  const [sessions, users] = await Promise.all([getAllSessions(), getAllUsers()])
  // Fetch vote counts + statements for every session in parallel so the host
  // can review the entered statements (and which one is the lie) at a glance.
  const details = await Promise.all(
    sessions.map(async (s) => {
      const [votes, statements] = await Promise.all([getVotesForSession(s.id), getStatements(s.id)])
      return { id: s.id, count: votes.length, statements }
    })
  )
  const detailMap = Object.fromEntries(details.map((d) => [d.id, d]))

  const initialSessions = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    author_name: s.author_name,
    status: s.status,
    created_at: s.created_at,
    votes: detailMap[s.id]?.count ?? 0,
    statements: (detailMap[s.id]?.statements ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((st) => ({ text: st.text, is_lie: st.is_lie })),
  }))

  return (
    <AdminTwoTruthsClient
      initialSessions={initialSessions}
      users={users.map((u) => ({ user_id: u.user_id, name: u.name ?? u.email, email: u.email }))}
    />
  )
}
