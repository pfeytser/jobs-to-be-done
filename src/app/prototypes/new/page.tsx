import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { NewPrototypeForm } from './NewPrototypeForm'

export const dynamic = 'force-dynamic'

export default async function NewPrototypePage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/prototypes')

  return (
    <main className="max-w-content mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/prototypes" className="text-xs text-ink-muted hover:text-ink transition-colors">
          ← Back to prototypes
        </Link>
        <h1 className="font-display leading-tight tracking-tight text-2xl font-light text-ink mt-2 mb-1">New prototype</h1>
        <p className="text-sm text-ink-muted">Upload an HTML file to host and share it with anyone at Industrious.</p>
      </div>
      <div className="bg-surface border border-line rounded-md p-6">
        <NewPrototypeForm />
      </div>
    </main>
  )
}
