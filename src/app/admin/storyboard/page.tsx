import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import AdminStoryboardClient from './AdminStoryboardClient'

export const dynamic = 'force-dynamic'

export default async function AdminStoryboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/storyboard')

  return <AdminStoryboardClient />
}
