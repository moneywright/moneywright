import { createMiddleware } from 'hono/factory'
import { isDevelopment } from '../lib/startup'

/**
 * Security headers middleware
 * Adds common security headers to all responses
 */
export const securityHeaders = () => {
  return createMiddleware(async (c, next) => {
    await next()

    // Basic security headers
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('X-Frame-Options', 'DENY')
    c.res.headers.set('X-XSS-Protection', '1; mode=block')
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // HSTS only in production (requires HTTPS)
    if (!isDevelopment()) {
      c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }

    // Content Security Policy
    c.res.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
    )
  })
}

/**
 * Auth-specific security headers
 * Extra headers for authentication routes
 */
export const authSecurityHeaders = () => {
  return createMiddleware(async (c, next) => {
    await next()

    // Prevent caching of auth responses
    c.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    c.res.headers.set('Pragma', 'no-cache')
  })
}
