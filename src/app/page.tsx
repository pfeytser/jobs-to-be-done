import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getActiveExercise } from '@/lib/db/exercises'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const activeExercise = await getActiveExercise()

  if (activeExercise) {
    redirect('/jtbd')
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6 animate-bounce">🐝</div>
        <h1 className="text-3xl font-bold text-ink mb-3">
          Jobs to Bee Done
        </h1>
        <p className="text-lg text-ink-2 font-medium mb-4">
          We&apos;ll start soon!
        </p>
        <p className="text-ink-3 text-sm">
          Your facilitator is getting things set up. Hang tight!
        </p>
      </div>
    </div>
  )
}
