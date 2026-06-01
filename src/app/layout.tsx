import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth/config'
import NextTopLoader from 'nextjs-toploader'
import { Header } from '@/components/Header'
import { recordUser } from '@/lib/db/users'

export const metadata: Metadata = {
  title: 'Jobs to Bee Done 🐝',
  description: 'A JTBD workshop tool for Industrious',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Auto-register every @industriousoffice.com account on first sign-in so the
  // admin can later assign anyone as a statement author.
  if (session?.user?.email && session.user.userId) {
    try {
      await recordUser({
        userId: session.user.userId,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      })
    } catch (error) {
      console.error('[layout] recordUser failed', error)
    }
  }

  return (
    <html lang="en">
      <body className="bg-canvas min-h-screen">
        <NextTopLoader color="#1a1a1a" showSpinner={false} />
        <SessionProvider session={session}>
          <Header />
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
