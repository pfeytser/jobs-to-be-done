import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { CodeReviewClient } from './CodeReviewClient'

export const dynamic = 'force-dynamic'

export default async function CodeReviewPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/')
  return <CodeReviewClient />
}
