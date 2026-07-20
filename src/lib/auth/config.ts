import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

const ALLOWED_DOMAINS = ['industriousoffice.com']
const ALLOWED_EMAILS = ['p.feytser.jr@gmail.com']
const ADMIN_EMAIL = 'pfeytser@industriousoffice.com'

function isAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  // Reject anything that isn't a single, well-formed address. Guards against
  // tricks like `x@industriousoffice.com@evil.com` where naive `split('@')[1]`
  // would read the wrong segment.
  if (!/^[^@\s]+@[^@\s]+$/.test(normalized)) return false
  if (ALLOWED_EMAILS.includes(normalized)) return true
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1)
  return ALLOWED_DOMAINS.includes(domain)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
    // Tighter than the 30-day default: shortens the window in which a stolen
    // session cookie is usable. Stateless JWTs can't be revoked server-side.
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = user.email
      if (!email) return false
      // The domain allowlist is only meaningful if the provider actually
      // verified ownership of the address. Never trust an unverified email.
      if (account?.provider === 'google') {
        const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified
        if (verified !== true) return false
      }
      return isAllowedEmail(email)
    },

    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        token.role = user.email === ADMIN_EMAIL ? 'admin' : 'collaborator'
        token.userId = token.sub ?? user.email
      }

      if (!token.role && token.email) {
        token.role =
          token.email === ADMIN_EMAIL ? 'admin' : 'collaborator'
      }

      return token
    },

    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          name: (token.name as string) ?? session.user.name,
          email: (token.email as string) ?? session.user.email,
          image: (token.picture as string) ?? session.user.image,
          role: (token.role as 'admin' | 'collaborator') ?? 'collaborator',
          userId: (token.userId as string) ?? token.sub ?? '',
        },
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
})

// Augment next-auth types
declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      role: 'admin' | 'collaborator'
      userId: string
    }
  }
}
