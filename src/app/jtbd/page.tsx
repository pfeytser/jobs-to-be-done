import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getActiveExercise } from '@/lib/db/exercises'
import { PhaseView } from '@/components/PhaseView'
import { JTBDInfoAccordion } from '@/components/JTBDInfoAccordion'
import { signOut } from '@/lib/auth/config'

export const dynamic = 'force-dynamic'

export default async function JTBDPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const activeExercise = await getActiveExercise()

  if (!activeExercise) {
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

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-warm-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐝</span>
            <span className="font-semibold text-ink">Jobs to Bee Done</span>
          </div>
          <div className="flex items-center gap-3">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? 'User'}
                className="w-7 h-7 rounded-full object-cover"
              />
            )}
            <span className="text-sm text-ink-2 hidden sm:block">
              {session.user.name ?? session.user.email}
            </span>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/auth/signin' })
              }}
            >
              <button
                type="submit"
                className="text-xs text-ink-3 hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink mb-2">
            {activeExercise.name}
          </h1>
          {activeExercise.mainPrompt && (
            <p className="text-base font-medium text-ink leading-snug max-w-2xl">
              {activeExercise.mainPrompt}
            </p>
          )}
          <JTBDInfoAccordion />
        </div>

        <PhaseView
          exercise={activeExercise}
          userId={session.user.userId}
        />
      </main>
    </div>
  )
}
