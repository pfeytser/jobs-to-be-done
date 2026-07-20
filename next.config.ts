import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    // Applied to everything EXCEPT the prototype render endpoint, which serves
    // arbitrary hosted HTML (sandboxed in an opaque-origin iframe) that may
    // legitimately load external assets. A strict CSP there would break it.
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      // Next.js injects inline hydration scripts; without a nonce architecture
      // 'unsafe-inline' is required. DOMPurify covers the inline-XSS sinks.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-src 'self'",
    ].join('; ')

    const baseHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ]

    return [
      {
        // All routes except the prototype render endpoint.
        source: '/((?!api/prototypes/[^/]+/render).*)',
        headers: [
          ...baseHeaders,
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
      {
        // Prototype render endpoint: security headers minus the app CSP.
        source: '/api/prototypes/:id/render',
        headers: baseHeaders,
      },
    ]
  },
}

export default nextConfig
