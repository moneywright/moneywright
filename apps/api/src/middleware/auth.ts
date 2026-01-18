import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { verifyJWT, type AccessTokenPayload } from '../lib/jwt'
import { verifyFingerprint, hashForLog } from '../lib/hash'
import { logger } from '../lib/logger'
import { isDevelopment, isAuthEnabled } from '../lib/startup'
import { DEFAULT_USER_ID } from '../lib/constants'

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
 * In local mode (AUTH_ENABLED=false), auto-authenticates as default user.
 *
 * Sets context variables:
 * - userId: The authenticated user's ID (or "default" in local mode)
 * - sessionId: The current session ID (or null in local mode)
 *
 * Returns 401 if:
 * - Auth is enabled AND no access token provided
 * - Auth is enabled AND token is invalid or expired
 * - Auth is enabled AND fingerprint validation fails
 */
export const auth = () => {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    // In local mode, auto-authenticate as default user
    if (!isAuthEnabled()) {
      c.set('userId', DEFAULT_USER_ID)
      c.set('sessionId', null)
      await next()
      return
    }

    // Get access token from cookie or Authorization header
    const accessToken =
      getCookie(c, COOKIE_NAMES.ACCESS_TOKEN) || extractBearerToken(c.req.header('Authorization'))

    if (!accessToken) {
      logger.debug('[Auth] No access token provided')
      return c.json({ error: 'unauthorized', message: 'Authentication required' }, 401)
    }

    // Verify token
    const result = verifyJWT<AccessTokenPayload>(accessToken)

    if (!result.valid || !result.payload) {
      logger.debug(`[Auth] Invalid token: ${result.error}`)
      return c.json({ error: 'unauthorized', message: result.error || 'Invalid token' }, 401)
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
 * In local mode, always authenticates as default user.
 * Useful for routes that have different behavior for authenticated vs anonymous users.
 */
export const optionalAuth = () => {
  return createMiddleware<{ Variables: Partial<AuthVariables> }>(async (c, next) => {
    // In local mode, auto-authenticate as default user
    if (!isAuthEnabled()) {
      c.set('userId', DEFAULT_USER_ID)
      c.set('sessionId', null)
      await next()
      return
    }

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
