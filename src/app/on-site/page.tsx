import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getUserProfile } from '@/lib/db/user-profiles'
import SeaCreatureForm from './SeaCreatureForm'
import AvatarCard from './AvatarCard'
import { AdminNav } from '@/components/AdminNav'

export const dynamic = 'force-dynamic'

export default async function OnSitePage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const profile = await getUserProfile(session.user.userId)
  const needsPrompt = !profile?.sea_creature && !profile?.sea_creature_skipped

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-warm-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="font-semibold text-ink">On-site</span>
          <div className="flex items-center gap-3">
            <AdminNav role={session.user.role} />
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? ''}
                className="w-7 h-7 rounded-full object-cover"
              />
            )}
            <span className="text-sm text-ink-2 hidden sm:block">
              {session.user.name ?? session.user.email}
            </span>
          </div>
        </div>
      </header>

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
