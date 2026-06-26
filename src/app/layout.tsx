import type { Metadata } from 'next'
import { Hanken_Grotesk, Newsreader } from 'next/font/google'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth/config'
import NextTopLoader from 'nextjs-toploader'
import { Header } from '@/components/Header'
import { ToastProvider } from '@/components/ui'
import { recordUser } from '@/lib/db/users'

// Brand type: Hanken Grotesk (workhorse sans) + Newsreader (editorial display).
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-hanken',
  display: 'swap',
})
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
})

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
    <html lang="en" className={`${hanken.variable} ${newsreader.variable}`}>
      <body className="bg-canvas min-h-screen">
        <NextTopLoader color="#013E3F" showSpinner={false} />
        <SessionProvider session={session}>
          <ToastProvider>
            <Header />
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
