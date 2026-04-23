import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getUserProfile } from '@/lib/db/user-profiles'
import SeaCreatureForm from './SeaCreatureForm'
import AvatarCard from './AvatarCard'
export const dynamic = 'force-dynamic'

export default async function OnSitePage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const profile = await getUserProfile(session.user.userId)
  const needsPrompt = !profile?.sea_creature && !profile?.sea_creature_skipped

  return (
    <div className="min-h-screen bg-canvas">
      <main className="max-w-lg mx-auto px-6 py-12">
        {needsPrompt ? (
          <SeaCreatureForm userId={session.user.userId} />
        ) : (
          <OnSiteLanding profile={profile} />
        )}
      </main>
    </div>
  )
}

function OnSiteLanding({ profile }: { profile: { sea_creature?: string | null; sea_creature_avatar?: string | null } | null }) {
  return (
    <div className="space-y-8">
      {profile?.sea_creature && (
        <AvatarCard
          seaCreature={profile.sea_creature}
          avatarUrl={profile.sea_creature_avatar ?? null}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">Welcome to On-site</h1>
        <p className="text-sm text-ink-3 mb-6">Ready to build your storyboard?</p>
        <a
          href="/storyboard"
          className="flex items-center justify-between w-full p-5 bg-surface border border-warm-border rounded-[16px] hover:border-ink transition-colors group"
        >
          <div>
            <p className="text-base font-semibold text-ink">Storyboards</p>
            <p className="text-sm text-ink-3 mt-0.5">Create and view customer journey storyboards</p>
          </div>
          <svg className="w-5 h-5 text-ink-3 group-hover:text-ink transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  )
}
