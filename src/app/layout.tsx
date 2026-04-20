import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth/config'
import NextTopLoader from 'nextjs-toploader'

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

  return (
    <html lang="en">
      <body className="bg-canvas min-h-screen">
        <NextTopLoader color="#1a1a1a" showSpinner={false} />
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
