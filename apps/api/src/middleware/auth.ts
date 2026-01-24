import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { verifyJWT, type AccessTokenPayload } from '../lib/jwt'
import { verifyFingerprint, hashForLog } from '../lib/hash'
import { logger } from '../lib/logger'
import { isDevelopment, isAuthEnabled } from '../lib/startup'

/**
 * Auth context variables set by middleware.
 */
export interface AuthVariables {
  userId: string
  sessionId: string | null
}

/**
 * Cookie names for auth tokens.
 * In production (HTTPS), use __Host- prefix for maximum security.
 * In development (HTTP), use regular names since __Host- requires Secure flag.
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: isDevelopment() ? 'sid' : '__Host-sid',
  REFRESH_TOKEN: isDevelopment() ? 'rid' : '__Host-rid',
  FINGERPRINT: isDevelopment() ? 'fgp' : '__Host-fgp',
} as const

/**
 * Extract bearer token from Authorization header.
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}

/**
 * Auth middleware - verifies JWT access token and fingerprint.
 * Always validates tokens (even in local mode).
 *
 * Sets context variables:
 * - userId: The authenticated user's ID
 * - sessionId: The current session ID
 *
 * Returns 401 if:
 * - No access token provided
 * - Token is invalid or expired
 * - Fingerprint validation fails
 *
 * In local mode (AUTH_ENABLED=false):
 * - Returns 401 with 'local_login_required' error (frontend should call POST /auth/local)
 * - Tokens have extended expiry (7 day access, 1 year refresh)
 */
export const auth = () => {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    // Get access token from cookie or Authorization header
    const accessToken =
      getCookie(c, COOKIE_NAMES.ACCESS_TOKEN) || extractBearerToken(c.req.header('Authorization'))

    if (!accessToken) {
      logger.debug('[Auth] No access token provided')
      // Different error for local mode to help frontend auto-login
      if (!isAuthEnabled()) {
        return c.json(
          {
            error: 'local_login_required',
            message: 'Local authentication required',
            authEnabled: false,
          },
          401
        )
      }
      return c.json(
        { error: 'unauthorized', message: 'Authentication required', authEnabled: true },
        401
      )
    }

    // Verify token
    const result = verifyJWT<AccessTokenPayload>(accessToken)

    if (!result.valid || !result.payload) {
      logger.debug(`[Auth] Invalid token: ${result.error}`)
      if (!isAuthEnabled()) {
        return c.json(
          {
            error: 'local_login_required',
            message: 'Local authentication required',
            authEnabled: false,
          },
          401
        )
      }
      return c.json(
        { error: 'unauthorized', message: result.error || 'Invalid token', authEnabled: true },
        401
      )
    }

    // Verify token type
    if (result.payload.type !== 'access') {
      logger.debug('[Auth] Wrong token type')
      return c.json({ error: 'unauthorized', message: 'Invalid token type' }, 401)
    }

    // Get fingerprint from header or cookie and verify against token's hash
    const fingerprint = c.req.header('X-Fingerprint') || getCookie(c, COOKIE_NAMES.FINGERPRINT)
    if (!fingerprint) {
      logger.debug('[Auth] No fingerprint provided')
      return c.json({ error: 'unauthorized', message: 'Invalid session' }, 401)
    }

    if (!verifyFingerprint(fingerprint, result.payload.fgp)) {
      logger.debug(`[Auth] Fingerprint mismatch for user ${hashForLog(result.payload.sub)}`)
      return c.json({ error: 'unauthorized', message: 'Invalid session' }, 401)
    }

    // Set context variables
    c.set('userId', result.payload.sub)
    c.set('sessionId', result.payload.sid)

    await next()
  })
}

/**
 * Optional auth middleware - same as auth but doesn't return 401.
 * Sets userId to null if not authenticated.
 * Useful for routes that have different behavior for authenticated vs anonymous users.
 */
export const optionalAuth = () => {
  return createMiddleware<{ Variables: Partial<AuthVariables> }>(async (c, next) => {
    const accessToken =
      getCookie(c, COOKIE_NAMES.ACCESS_TOKEN) || extractBearerToken(c.req.header('Authorization'))

    if (!accessToken) {
      await next()
      return
    }

    const result = verifyJWT<AccessTokenPayload>(accessToken)

    if (!result.valid || !result.payload || result.payload.type !== 'access') {
      await next()
      return
    }

    const fingerprint = c.req.header('X-Fingerprint') || getCookie(c, COOKIE_NAMES.FINGERPRINT)
    if (!fingerprint || !verifyFingerprint(fingerprint, result.payload.fgp)) {
      await next()
      return
    }

    c.set('userId', result.payload.sub)
    c.set('sessionId', result.payload.sid)

    await next()
  })
}

/**
 * Utility to check if request is authenticated.
 */
export function isAuthenticated(c: { get: (key: string) => unknown }): boolean {
  return typeof c.get('userId') === 'string'
}
