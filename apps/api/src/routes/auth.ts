import { Hono, type Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { auth, COOKIE_NAMES, type AuthVariables } from '../middleware/auth'
import { logger } from '../lib/logger'
import { authSecurityHeaders } from '../middleware/security-headers'
import {
  verifyJWT,
  getAccessTokenExpiry,
  getRefreshTokenExpiry,
  type RefreshTokenPayload,
} from '../lib/jwt'
import { verifyFingerprint } from '../lib/hash'
import {
  generateAuthUrl,
  parseOAuthState,
  exchangeAuthCode,
  findUserByGoogleId,
  createUser,
  createSession,
  refreshSession,
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,
  getUserSessions,
  deleteUser,
} from '../services/auth'
import { ensureDefaultUser } from '../services/user'
import { isDevelopment, isAuthEnabled, isLocalhost } from '../lib/startup'

const authRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply security headers to all auth routes
authRoutes.use('*', authSecurityHeaders())

/**
 * Token expiry times in seconds
 */
export const TOKEN_EXPIRY = {
  accessToken: getAccessTokenExpiry(),
  refreshToken: getRefreshTokenExpiry(),
}

/**
 * Session hint cookie name (JS-accessible, used to skip /me call if no session)
 */
const SESSION_HINT_COOKIE = '_s'

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
 * Local mode token expiry (in seconds)
 * Note: Cookie max-age cannot exceed 400 days (34560000 seconds)
 */
const LOCAL_MODE_EXPIRY = {
  accessToken: 7 * 24 * 60 * 60, // 7 days
  refreshToken: 365 * 24 * 60 * 60, // 1 year
}

/**
 * Set auth cookies on response
 */
function setAuthCookies(
  c: Context,
  tokens: AuthTokens,
  expiry?: { accessToken: number; refreshToken: number }
): void {
  const tokenExpiry = expiry || TOKEN_EXPIRY

  const cookieOptions = {
    httpOnly: true,
    secure: !isLocalhost(), // Don't require HTTPS for localhost (desktop app, local dev)
    sameSite: 'lax' as const, // Use 'lax' for better compatibility with localhost
    path: '/',
  }

  // Access token cookie
  setCookie(c, COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, {
    ...cookieOptions,
    maxAge: tokenExpiry.accessToken,
  })

  // Refresh token cookie
  setCookie(c, COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
    ...cookieOptions,
    maxAge: tokenExpiry.refreshToken,
  })

  // Fingerprint cookie
  setCookie(c, COOKIE_NAMES.FINGERPRINT, tokens.fingerprint, {
    ...cookieOptions,
    maxAge: tokenExpiry.refreshToken,
  })

  // Session hint cookie (JS-accessible)
  setCookie(c, SESSION_HINT_COOKIE, '1', {
    httpOnly: false,
    secure: !isLocalhost(),
    sameSite: 'lax',
    path: '/',
    maxAge: tokenExpiry.refreshToken,
  })
}

/**
 * Clear all auth cookies
 */
function clearAuthCookies(c: Context): void {
  const cookieOptions = {
    path: '/',
    secure: !isLocalhost(),
    sameSite: 'lax' as const,
  }

  deleteCookie(c, COOKIE_NAMES.ACCESS_TOKEN, cookieOptions)
  deleteCookie(c, COOKIE_NAMES.REFRESH_TOKEN, cookieOptions)
  deleteCookie(c, COOKIE_NAMES.FINGERPRINT, cookieOptions)
  deleteCookie(c, SESSION_HINT_COOKIE, { ...cookieOptions, httpOnly: false })
}

/**
 * POST /auth/local
 * Auto-login for local mode (AUTH_ENABLED=false)
 * Creates default user if needed and creates session
 * Same flow as /auth/google/exchange but for local mode
 */
authRoutes.post('/local', async (c) => {
  // Only allow local login when auth is disabled
  if (isAuthEnabled()) {
    return c.json(
      { error: 'auth_enabled', message: 'Local login is not available when auth is enabled' },
      403
    )
  }

  try {
    // Ensure default user exists (creates if not)
    const user = await ensureDefaultUser()

    // Create session (same as Google OAuth flow)
    const session = await createSession(user.id, {
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    })

    // Set auth cookies with local mode expiry (7-day access, 1-year refresh)
    setAuthCookies(
      c,
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        fingerprint: session.fingerprint,
        expiresIn: session.expiresIn,
      },
      LOCAL_MODE_EXPIRY
    )

    // Return success (same format as Google OAuth)
    return c.json({
      success: true,
      type: 'local',
      isNewUser: false,
      redirectUrl: '/',
    })
  } catch (error) {
    logger.error('[Auth] Local login error:', error)
    return c.json({ error: 'auth_failed', message: 'Local authentication failed' }, 500)
  }
})

/**
 * GET /auth/google
 * Returns OAuth URL for frontend to navigate to
 */
authRoutes.get('/google', async (c) => {
  const redirect = c.req.query('redirect') || '/'

  try {
    const { url, state } = await generateAuthUrl({ redirectUrl: redirect })
    return c.json({ url, state })
  } catch (error) {
    // If Google credentials aren't configured, return setup required error
    if (error instanceof Error && error.message.includes('not configured')) {
      return c.json({ error: 'setup_required', message: error.message }, 503)
    }
    throw error
  }
})

/**
 * POST /auth/google/exchange
 * Exchanges OAuth code for tokens and creates session
 * Frontend calls this after Google redirects back with code
 */
authRoutes.post('/google/exchange', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { code, state: stateParam, error } = body

  // Handle OAuth errors
  if (error) {
    logger.error(`[Auth] OAuth error: ${error}`)
    return c.json({ error: 'oauth_error', message: error }, 400)
  }

  if (!code || !stateParam) {
    return c.json({ error: 'missing_params', message: 'Missing code or state' }, 400)
  }

  try {
    // Parse state from request body
    const state = parseOAuthState(stateParam)

    // Exchange code for tokens
    const { userInfo } = await exchangeAuthCode(code, state.pkceVerifier)

    // Regular login/signup flow
    let user = await findUserByGoogleId(userInfo.id!)
    let isNewUser = false

    if (!user) {
      // Create new user
      user = await createUser({
        googleId: userInfo.id!,
        email: userInfo.email!,
        name: userInfo.name,
        picture: userInfo.picture,
      })

      isNewUser = true
    }

    // Create session
    const session = await createSession(user.id, {
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    })

    // Set auth cookies
    setAuthCookies(c, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      fingerprint: session.fingerprint,
      expiresIn: session.expiresIn,
    })

    // Return success (no tokens in body - they're in cookies)
    return c.json({
      success: true,
      type: 'login',
      isNewUser,
      redirectUrl: state.redirectUrl || '/',
    })
  } catch (err) {
    logger.error('[Auth] Callback error:', err)
    return c.json({ error: 'auth_failed', message: 'Authentication failed' }, 500)
  }
})

/**
 * POST /auth/refresh
 * Refreshes access token using refresh token from cookies
 */
authRoutes.post('/refresh', async (c) => {
  // Read tokens from cookies
  const refreshToken = getCookie(c, COOKIE_NAMES.REFRESH_TOKEN)
  const fingerprint = getCookie(c, COOKIE_NAMES.FINGERPRINT)

  if (!refreshToken || !fingerprint) {
    clearAuthCookies(c)
    return c.json(
      { error: 'invalid_refresh_token', message: 'Session expired. Please log in again.' },
      401
    )
  }

  // Verify refresh token
  const result = verifyJWT<RefreshTokenPayload>(refreshToken)

  if (!result.valid || !result.payload || result.payload.type !== 'refresh') {
    clearAuthCookies(c)
    return c.json(
      { error: 'invalid_refresh_token', message: 'Session expired. Please log in again.' },
      401
    )
  }

  // Verify fingerprint
  if (!verifyFingerprint(fingerprint, result.payload.fgp)) {
    clearAuthCookies(c)
    return c.json(
      { error: 'invalid_refresh_token', message: 'Session expired. Please log in again.' },
      401
    )
  }

  // Refresh the session (with token rotation)
  const newTokens = await refreshSession(result.payload.sid, result.payload.fgp)

  if (!newTokens) {
    clearAuthCookies(c)
    return c.json(
      { error: 'invalid_refresh_token', message: 'Session expired. Please log in again.' },
      401
    )
  }

  // Set new cookies
  setAuthCookies(c, {
    accessToken: newTokens.accessToken,
    refreshToken: newTokens.refreshToken,
    fingerprint: newTokens.fingerprint,
    expiresIn: newTokens.expiresIn,
  })

  return c.json({ success: true })
})

/**
 * POST /auth/logout
 * Logs out the current session and clears cookies
 */
authRoutes.post('/logout', async (c) => {
  // Read refresh token from cookie
  const refreshToken = getCookie(c, COOKIE_NAMES.REFRESH_TOKEN)

  if (refreshToken) {
    const result = verifyJWT<RefreshTokenPayload>(refreshToken)
    if (result.valid && result.payload) {
      await revokeSession(result.payload.sid)
    }
  }

  // Clear all auth cookies
  clearAuthCookies(c)

  return c.json({ success: true })
})

/**
 * GET /auth/sessions
 * Lists all active sessions for current user
 */
authRoutes.get('/sessions', auth(), async (c) => {
  const userId = c.get('userId')
  const sessionId = c.get('sessionId')

  const sessions = await getUserSessions(userId, sessionId || undefined)

  return c.json({ sessions })
})

/**
 * DELETE /auth/sessions/:id
 * Revokes a specific session
 */
authRoutes.delete('/sessions/:id', auth(), async (c) => {
  const userId = c.get('userId')
  const targetSessionId = c.req.param('id')

  // Get session to verify ownership
  const sessions = await getUserSessions(userId)
  const targetSession = sessions.find((s) => s.id === targetSessionId)

  if (!targetSession) {
    return c.json({ error: 'session_not_found' }, 404)
  }

  // Revoke the session
  await revokeSession(targetSessionId)

  return c.json({ success: true })
})

/**
 * DELETE /auth/sessions
 * Revokes all sessions except current (logout everywhere else)
 */
authRoutes.delete('/sessions', auth(), async (c) => {
  const userId = c.get('userId')
  const currentSessionId = c.get('sessionId')

  if (!currentSessionId) {
    return c.json(
      { error: 'session_required', message: 'Session management requires authentication' },
      400
    )
  }

  const revokedCount = await revokeOtherSessions(userId, currentSessionId)

  return c.json({ success: true, revokedCount })
})

/**
 * DELETE /auth/account
 * Deletes user account and all associated data
 */
authRoutes.delete('/account', auth(), async (c) => {
  const userId = c.get('userId')

  // Require confirmation
  const body = await c.req.json().catch(() => ({}))
  if (body.confirmation !== 'DELETE') {
    return c.json(
      { error: 'confirmation_required', message: 'Send { confirmation: "DELETE" } to confirm' },
      400
    )
  }

  // Revoke all sessions first
  await revokeAllSessions(userId)

  // Delete the user and all associated data
  await deleteUser(userId)

  return c.json({ success: true })
})

export default authRoutes
