/**
 * PIN Authentication Routes
 * Handles PIN setup, verification, and recovery for local mode
 */

import { Hono, type Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { auth, COOKIE_NAMES, type AuthVariables } from '../middleware/auth'
import { authSecurityHeaders } from '../middleware/security-headers'
import { isAuthEnabled, isLocalhost } from '../lib/startup'
import { logger } from '../lib/logger'
import {
  isPinConfigured,
  setupPin,
  verifyPin,
  recoverWithBackupCode,
  changePin,
  regenerateBackupCode,
  checkLockout,
} from '../services/pin'
import { ensureDefaultUser } from '../services/user'
import { createSession } from '../services/auth'

const pinRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply security headers to all PIN routes
pinRoutes.use('*', authSecurityHeaders())

/**
 * Session hint cookie name (JS-accessible, used to skip /me call if no session)
 */
const SESSION_HINT_COOKIE = '_s'

/**
 * Local mode uses session cookies (no maxAge) so they expire when browser closes
 * This ensures PIN is required on every app launch
 */

/**
 * Auth token interface
 */
interface AuthTokens {
  accessToken: string
  refreshToken: string
  fingerprint: string
  expiresIn: number
}

/**
 * Set auth cookies on response
 * For PIN-based auth, we use session cookies (no maxAge) so they expire when browser closes
 */
function setAuthCookies(c: Context, tokens: AuthTokens): void {
  const cookieOptions = {
    httpOnly: true,
    secure: !isLocalhost(),
    sameSite: 'lax' as const,
    path: '/',
    // No maxAge = session cookie, expires when browser closes
  }

  setCookie(c, COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, cookieOptions)
  setCookie(c, COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookieOptions)
  setCookie(c, COOKIE_NAMES.FINGERPRINT, tokens.fingerprint, cookieOptions)

  // Session hint cookie (JS-accessible)
  setCookie(c, SESSION_HINT_COOKIE, '1', {
    httpOnly: false,
    secure: !isLocalhost(),
    sameSite: 'lax',
    path: '/',
    // No maxAge = session cookie
  })
}

/**
 * GET /auth/pin/status
 * Check if PIN is configured (unauthenticated)
 * Used by frontend to determine if PIN setup or unlock is needed
 */
pinRoutes.get('/status', async (c) => {
  // Only available when auth is disabled (local mode)
  if (isAuthEnabled()) {
    return c.json(
      { error: 'auth_enabled', message: 'PIN is not available when auth is enabled' },
      403
    )
  }

  const configured = await isPinConfigured()
  return c.json({ configured })
})

/**
 * POST /auth/pin/setup
 * Set up PIN for the first time
 * Returns backup code that user must save
 * Creates session after setup
 */
pinRoutes.post('/setup', async (c) => {
  // Only available when auth is disabled (local mode)
  if (isAuthEnabled()) {
    return c.json(
      { error: 'auth_enabled', message: 'PIN is not available when auth is enabled' },
      403
    )
  }

  try {
    const body = await c.req.json().catch(() => ({}))
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return c.json({ error: 'invalid_request', message: 'PIN is required' }, 400)
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      return c.json({ error: 'invalid_pin', message: 'PIN must be exactly 6 digits' }, 400)
    }

    // Setup PIN
    const result = await setupPin(pin)

    // Create session for the user
    const user = await ensureDefaultUser()
    const session = await createSession(user.id, {
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    })

    // Set auth cookies (session cookies - expire when browser closes)
    setAuthCookies(c, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      fingerprint: session.fingerprint,
      expiresIn: session.expiresIn,
    })

    logger.info('[PIN] PIN setup completed, session created')

    return c.json({
      success: true,
      backupCode: result.backupCode,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'PIN is already configured') {
      return c.json({ error: 'already_configured', message: 'PIN is already configured' }, 400)
    }
    logger.error('[PIN] Setup error:', error)
    return c.json({ error: 'setup_failed', message: 'Failed to setup PIN' }, 500)
  }
})

/**
 * POST /auth/pin/verify
 * Verify PIN and create session
 */
pinRoutes.post('/verify', async (c) => {
  // Only available when auth is disabled (local mode)
  if (isAuthEnabled()) {
    return c.json(
      { error: 'auth_enabled', message: 'PIN is not available when auth is enabled' },
      403
    )
  }

  try {
    const body = await c.req.json().catch(() => ({}))
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return c.json({ error: 'invalid_request', message: 'PIN is required' }, 400)
    }

    // Verify PIN
    const result = await verifyPin(pin)

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.error,
          retryAfter: result.retryAfter,
          attemptsRemaining: result.attemptsRemaining,
        },
        401
      )
    }

    // Create session for the user
    const user = await ensureDefaultUser()
    const session = await createSession(user.id, {
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    })

    // Set auth cookies (session cookies - expire when browser closes)
    setAuthCookies(c, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      fingerprint: session.fingerprint,
      expiresIn: session.expiresIn,
    })

    logger.info('[PIN] PIN verified, session created')

    return c.json({ success: true })
  } catch (error) {
    logger.error('[PIN] Verify error:', error)
    return c.json({ error: 'verify_failed', message: 'Failed to verify PIN' }, 500)
  }
})

/**
 * POST /auth/pin/recover
 * Use backup code to reset PIN
 * Creates session after recovery
 */
pinRoutes.post('/recover', async (c) => {
  // Only available when auth is disabled (local mode)
  if (isAuthEnabled()) {
    return c.json(
      { error: 'auth_enabled', message: 'PIN is not available when auth is enabled' },
      403
    )
  }

  try {
    const body = await c.req.json().catch(() => ({}))
    const { backupCode, newPin } = body

    if (!backupCode || typeof backupCode !== 'string') {
      return c.json({ error: 'invalid_request', message: 'Backup code is required' }, 400)
    }

    if (!newPin || typeof newPin !== 'string') {
      return c.json({ error: 'invalid_request', message: 'New PIN is required' }, 400)
    }

    // Validate new PIN format
    if (!/^\d{6}$/.test(newPin)) {
      return c.json({ error: 'invalid_pin', message: 'PIN must be exactly 6 digits' }, 400)
    }

    // Recover with backup code
    const result = await recoverWithBackupCode(backupCode, newPin)

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.error,
          retryAfter: result.retryAfter,
          attemptsRemaining: result.attemptsRemaining,
        },
        401
      )
    }

    // Create session for the user
    const user = await ensureDefaultUser()
    const session = await createSession(user.id, {
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    })

    // Set auth cookies (session cookies - expire when browser closes)
    setAuthCookies(c, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      fingerprint: session.fingerprint,
      expiresIn: session.expiresIn,
    })

    logger.info('[PIN] PIN recovered, session created')

    return c.json({
      success: true,
      backupCode: result.backupCode,
    })
  } catch (error) {
    logger.error('[PIN] Recover error:', error)
    return c.json({ error: 'recover_failed', message: 'Failed to recover PIN' }, 500)
  }
})

/**
 * POST /auth/pin/change
 * Change PIN (requires valid session and current PIN)
 */
pinRoutes.post('/change', auth(), async (c) => {
  // Only available when auth is disabled (local mode)
  if (isAuthEnabled()) {
    return c.json(
      { error: 'auth_enabled', message: 'PIN is not available when auth is enabled' },
      403
    )
  }

  try {
    const body = await c.req.json().catch(() => ({}))
    const { currentPin, newPin } = body

    if (!currentPin || typeof currentPin !== 'string') {
      return c.json({ error: 'invalid_request', message: 'Current PIN is required' }, 400)
    }

    if (!newPin || typeof newPin !== 'string') {
      return c.json({ error: 'invalid_request', message: 'New PIN is required' }, 400)
    }

    // Validate new PIN format
    if (!/^\d{6}$/.test(newPin)) {
      return c.json({ error: 'invalid_pin', message: 'PIN must be exactly 6 digits' }, 400)
    }

    // Change PIN
    const result = await changePin(currentPin, newPin)

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 401)
    }

    logger.info('[PIN] PIN changed successfully')

    return c.json({ success: true })
  } catch (error) {
    logger.error('[PIN] Change error:', error)
    return c.json({ error: 'change_failed', message: 'Failed to change PIN' }, 500)
  }
})

/**
 * POST /auth/pin/regenerate-backup
 * Generate new backup code (requires valid session AND PIN verification)
 * Invalidates old backup code
 */
pinRoutes.post('/regenerate-backup', auth(), async (c) => {
  // Only available when auth is disabled (local mode)
  if (isAuthEnabled()) {
    return c.json(
      { error: 'auth_enabled', message: 'PIN is not available when auth is enabled' },
      403
    )
  }

  try {
    const body = await c.req.json().catch(() => ({}))
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return c.json({ error: 'invalid_request', message: 'PIN is required' }, 400)
    }

    // Verify PIN first
    const verifyResult = await verifyPin(pin)
    if (!verifyResult.success) {
      return c.json(
        {
          success: false,
          error: verifyResult.error,
          retryAfter: verifyResult.retryAfter,
          attemptsRemaining: verifyResult.attemptsRemaining,
        },
        401
      )
    }

    // PIN verified, now regenerate backup code
    const result = await regenerateBackupCode()

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400)
    }

    logger.info('[PIN] Backup code regenerated')

    return c.json({
      success: true,
      backupCode: result.backupCode,
    })
  } catch (error) {
    logger.error('[PIN] Regenerate backup error:', error)
    return c.json({ error: 'regenerate_failed', message: 'Failed to regenerate backup code' }, 500)
  }
})

export default pinRoutes
