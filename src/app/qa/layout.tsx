import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { signOut } from '@/lib/auth/config'
import { QAHeader } from '@/components/qa/QAHeader'

export default async function QALayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-canvas">
      <QAHeader
        role={session.user.role}
        userName={session.user.name}
        userImage={session.user.image}
        onSignOut={async () => {
          'use server'
          await signOut({ redirectTo: '/auth/signin' })
        }}
      />
      {children}
    </div>
  )
}
