import { google, type oauth2_v2 } from 'googleapis'
import { CodeChallengeMethod } from 'google-auth-library'
import { eq, and, isNull, count, lt, ne } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { User } from '../db'
import { nanoid } from '../lib/id'
import { signJWT, getAccessTokenExpiry, getRefreshTokenExpiry } from '../lib/jwt'
import {
  generateFingerprint,
  hashRefreshToken,
  generateRandomString,
  hashForLog,
} from '../lib/hash'
import { generatePKCEPair } from '../lib/pkce'
import { encrypt, decrypt } from '../lib/encryption'
import { getGoogleCredentials, getAppUrl } from './config'
import { logger } from '../lib/logger'

/**
 * Authentication service
 * Handles user authentication, sessions, and token management
 */

// Session absolute timeout (30 days in seconds)
const SESSION_ABSOLUTE_TIMEOUT = 30 * 24 * 60 * 60

// Google OAuth scopes - customize based on your needs
const AUTH_SCOPES = ['openid', 'email', 'profile']

/**
 * OAuth state stored in cookie during auth flow
 */
export interface OAuthState {
  pkceVerifier: string
  redirectUrl: string
}

/**
 * Result of creating a session
 */
export interface SessionResult {
  accessToken: string
  refreshToken: string
  fingerprint: string
  expiresIn: number
  user: User
}

/**
 * Get OAuth2 client configured for authentication
 * Reads credentials from env vars (priority) or database
 * Redirect URI is derived from APP_URL + /auth/google/callback
 */
export async function getAuthOAuth2Client() {
  const { clientId, clientSecret, isConfigured } = await getGoogleCredentials()

  if (!isConfigured || !clientId || !clientSecret) {
    throw new Error(
      'Google OAuth credentials not configured. Complete setup at /setup or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
    )
  }

  // Derive redirect URI from APP_URL
  const appUrl = await getAppUrl()
  const redirectUri = `${appUrl}/auth/google/callback`

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/**
 * Generate Google OAuth authorization URL with PKCE
 */
export async function generateAuthUrl(options: { redirectUrl?: string } = {}): Promise<{
  url: string
  state: OAuthState
}> {
  const oauth2Client = await getAuthOAuth2Client()
  const { verifier, challenge } = generatePKCEPair()

  const state: OAuthState = {
    pkceVerifier: verifier,
    redirectUrl: options.redirectUrl || '/',
  }

  // Encrypt state to prevent tampering
  const encryptedState = encrypt(JSON.stringify(state))

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: AUTH_SCOPES,
    prompt: 'consent', // Force consent to get refresh token
    code_challenge: challenge,
    code_challenge_method: CodeChallengeMethod.S256,
    state: encryptedState,
  })

  return { url, state }
}

/**
 * Parse and verify OAuth state
 */
export function parseOAuthState(encryptedState: string): OAuthState {
  try {
    const decrypted = decrypt(encryptedState)
    return JSON.parse(decrypted) as OAuthState
  } catch {
    throw new Error('Invalid OAuth state')
  }
}

/**
 * Exchange authorization code for tokens and user info
 */
export async function exchangeAuthCode(
  code: string,
  pkceVerifier: string
): Promise<{
  tokens: {
    accessToken: string
    refreshToken: string
    expiryDate: number
    scope: string
    tokenType: string
  }
  userInfo: oauth2_v2.Schema$Userinfo
}> {
  const oauth2Client = await getAuthOAuth2Client()

  // Exchange code with PKCE verifier
  const { tokens } = await oauth2Client.getToken({
    code,
    codeVerifier: pkceVerifier,
  })

  if (!tokens.access_token) {
    throw new Error('Failed to exchange code for tokens')
  }

  // Get user info
  oauth2Client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data: userInfo } = await oauth2.userinfo.get()

  if (!userInfo.id || !userInfo.email) {
    throw new Error('Failed to get user info from Google')
  }

  return {
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiryDate: tokens.expiry_date || Date.now() + 3600 * 1000,
      scope: tokens.scope || AUTH_SCOPES.join(' '),
      tokenType: tokens.token_type || 'Bearer',
    },
    userInfo,
  }
}

/**
 * Find user by Google ID
 */
export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.googleId, googleId))
    .limit(1)

  return user || null
}

/**
 * Find user by ID
 */
export async function findUserById(userId: string): Promise<User | null> {
  const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1)

  return user || null
}

/**
 * Create a new user
 */
export async function createUser(data: {
  googleId: string
  email: string
  name?: string | null
  picture?: string | null
}): Promise<User> {
  const [user] = await db
    .insert(tables.users)
    .values({
      googleId: data.googleId,
      email: data.email,
      name: data.name || null,
      picture: data.picture || null,
    })
    .returning()

  if (!user) {
    throw new Error('Failed to create user')
  }

  logger.debug(`[Auth] Created user ${hashForLog(user.id)} (${hashForLog(data.email)})`)
  return user
}

/**
 * Create a new session and issue tokens
 */
export async function createSession(
  userId: string,
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<SessionResult> {
  const user = await findUserById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  // Generate session ID and fingerprint
  const sessionId = nanoid()
  const { raw: fingerprint, hash: fingerprintHash } = generateFingerprint()

  // Generate refresh token (random string, not JWT)
  const refreshTokenRaw = generateRandomString(32, 'base64url')
  const refreshTokenHashValue = hashRefreshToken(refreshTokenRaw)

  // Calculate expiry times
  const now = new Date()
  const refreshExpiry = new Date(now.getTime() + getRefreshTokenExpiry() * 1000)
  const absoluteExpiry = new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT * 1000)

  // Create session in database
  await db.insert(tables.sessions).values({
    id: sessionId,
    userId,
    refreshTokenHash: refreshTokenHashValue,
    fingerprintHash,
    expiresAt: (dbType === 'postgres' ? refreshExpiry : refreshExpiry.toISOString()) as Date,
    absoluteExpiresAt: (dbType === 'postgres'
      ? absoluteExpiry
      : absoluteExpiry.toISOString()) as Date,
    userAgent: metadata?.userAgent || null,
    ipAddress: metadata?.ipAddress || null,
  })

  // Generate access token JWT
  const accessToken = signJWT({
    sub: userId,
    sid: sessionId,
    fgp: fingerprintHash,
    type: 'access',
  })

  // Generate refresh token JWT (includes session reference)
  const refreshToken = signJWT({
    sub: userId,
    sid: sessionId,
    fgp: fingerprintHash,
    type: 'refresh',
  })

  logger.debug(`[Auth] Created session ${hashForLog(sessionId)} for user ${hashForLog(userId)}`)

  return {
    accessToken,
    refreshToken,
    fingerprint,
    expiresIn: getAccessTokenExpiry(),
    user,
  }
}

/**
 * Refresh access token (with refresh token rotation)
 */
export async function refreshSession(
  sessionId: string,
  currentFingerprintHash: string
): Promise<{
  accessToken: string
  refreshToken: string
  fingerprint: string
  expiresIn: number
} | null> {
  // Find the session
  const [session] = await db
    .select()
    .from(tables.sessions)
    .where(and(eq(tables.sessions.id, sessionId), isNull(tables.sessions.revokedAt)))
    .limit(1)

  if (!session) {
    logger.debug(`[Auth] Session ${hashForLog(sessionId)} not found or revoked`)
    return null
  }

  // Verify fingerprint matches
  if (session.fingerprintHash !== currentFingerprintHash) {
    logger.debug(`[Auth] Fingerprint mismatch for session ${hashForLog(sessionId)}`)
    return null
  }

  // Check if session has expired (either refresh or absolute)
  const now = new Date()
  const expiresAt =
    typeof session.expiresAt === 'string' ? new Date(session.expiresAt) : session.expiresAt
  const absoluteExpiresAt =
    typeof session.absoluteExpiresAt === 'string'
      ? new Date(session.absoluteExpiresAt)
      : session.absoluteExpiresAt

  if (expiresAt < now) {
    logger.debug(`[Auth] Session ${hashForLog(sessionId)} refresh token expired`)
    return null
  }

  if (absoluteExpiresAt < now) {
    logger.debug(`[Auth] Session ${hashForLog(sessionId)} absolute timeout reached`)
    return null
  }

  // Generate new fingerprint and tokens (rotation)
  const { raw: newFingerprint, hash: newFingerprintHash } = generateFingerprint()
  const newRefreshTokenRaw = generateRandomString(32, 'base64url')
  const newRefreshTokenHash = hashRefreshToken(newRefreshTokenRaw)

  // Calculate new refresh expiry (rolling window)
  const newRefreshExpiry = new Date(now.getTime() + getRefreshTokenExpiry() * 1000)

  // Don't extend past absolute expiry
  const effectiveExpiry =
    newRefreshExpiry < absoluteExpiresAt ? newRefreshExpiry : absoluteExpiresAt

  // Update session with new token hash and fingerprint
  await db
    .update(tables.sessions)
    .set({
      refreshTokenHash: newRefreshTokenHash,
      fingerprintHash: newFingerprintHash,
      expiresAt: (dbType === 'postgres' ? effectiveExpiry : effectiveExpiry.toISOString()) as Date,
      lastUsedAt: (dbType === 'postgres' ? now : now.toISOString()) as Date,
    })
    .where(eq(tables.sessions.id, sessionId))

  // Generate new tokens
  const accessToken = signJWT({
    sub: session.userId,
    sid: sessionId,
    fgp: newFingerprintHash,
    type: 'access',
  })

  const refreshToken = signJWT({
    sub: session.userId,
    sid: sessionId,
    fgp: newFingerprintHash,
    type: 'refresh',
  })

  logger.debug(`[Auth] Refreshed session ${hashForLog(sessionId)}`)

  return {
    accessToken,
    refreshToken,
    fingerprint: newFingerprint,
    expiresIn: getAccessTokenExpiry(),
  }
}

/**
 * Revoke a session (logout)
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  await db
    .update(tables.sessions)
    .set({ revokedAt: now as Date })
    .where(and(eq(tables.sessions.id, sessionId), isNull(tables.sessions.revokedAt)))

  logger.debug(`[Auth] Revoked session ${hashForLog(sessionId)}`)
  return true
}

/**
 * Revoke all sessions for a user except the current one
 */
export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string
): Promise<number> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Get count of sessions to revoke
  const [countResult] = await db
    .select({ count: count() })
    .from(tables.sessions)
    .where(
      and(
        eq(tables.sessions.userId, userId),
        ne(tables.sessions.id, currentSessionId),
        isNull(tables.sessions.revokedAt)
      )
    )

  const revokeCount = countResult?.count || 0

  if (revokeCount > 0) {
    await db
      .update(tables.sessions)
      .set({ revokedAt: now as Date })
      .where(
        and(
          eq(tables.sessions.userId, userId),
          ne(tables.sessions.id, currentSessionId),
          isNull(tables.sessions.revokedAt)
        )
      )

    logger.debug(`[Auth] Revoked ${revokeCount} other sessions for user ${hashForLog(userId)}`)
  }

  return revokeCount
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [countResult] = await db
    .select({ count: count() })
    .from(tables.sessions)
    .where(and(eq(tables.sessions.userId, userId), isNull(tables.sessions.revokedAt)))

  const revokeCount = countResult?.count || 0

  if (revokeCount > 0) {
    await db
      .update(tables.sessions)
      .set({ revokedAt: now as Date })
      .where(and(eq(tables.sessions.userId, userId), isNull(tables.sessions.revokedAt)))

    logger.debug(`[Auth] Revoked all ${revokeCount} sessions for user ${hashForLog(userId)}`)
  }

  return revokeCount
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(
  userId: string,
  currentSessionId?: string
): Promise<
  Array<{
    id: string
    current: boolean
    userAgent: string | null
    ipAddress: string | null
    createdAt: Date | string
    lastUsedAt: Date | string
  }>
> {
  const sessions = await db
    .select({
      id: tables.sessions.id,
      userAgent: tables.sessions.userAgent,
      ipAddress: tables.sessions.ipAddress,
      createdAt: tables.sessions.createdAt,
      lastUsedAt: tables.sessions.lastUsedAt,
    })
    .from(tables.sessions)
    .where(and(eq(tables.sessions.userId, userId), isNull(tables.sessions.revokedAt)))
    .orderBy(tables.sessions.lastUsedAt)

  return sessions.map((s) => ({
    ...s,
    current: s.id === currentSessionId,
  }))
}

/**
 * Clean up expired sessions (can be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Delete sessions that have passed their absolute expiry
  await db.delete(tables.sessions).where(lt(tables.sessions.absoluteExpiresAt, now as Date))

  return 0 // Drizzle doesn't return delete count easily
}

/**
 * Delete user and all associated data
 */
export async function deleteUser(userId: string): Promise<void> {
  // Cascade delete will handle sessions, but we should log
  logger.debug(`[Auth] Deleting user ${hashForLog(userId)} and all associated data`)

  // Delete the user (cascades to sessions via FK)
  await db.delete(tables.users).where(eq(tables.users.id, userId))

  logger.debug(`[Auth] Deleted user ${hashForLog(userId)}`)
}
