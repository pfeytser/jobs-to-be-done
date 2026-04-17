import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { CreateProjectForm } from './CreateProjectForm'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if (session.user.role !== 'admin') redirect('/qa')

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/qa/admin" className="text-xs text-ink-3 hover:text-ink transition-colors">
          ← Back to admin
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2 mb-1">New QA Project</h1>
        <p className="text-sm text-ink-3">Fill in the details below. You can edit everything later.</p>
      </div>
      <div className="bg-surface border border-warm-border rounded-[14px] p-6">
        <CreateProjectForm />
      </div>
    </main>
  )
}
