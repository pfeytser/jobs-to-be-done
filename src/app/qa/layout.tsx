import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'

export default async function QALayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-canvas">
      {children}
    </div>
  )
}
