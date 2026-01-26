import { createHmac } from 'crypto'

/**
 * JWT utilities for authentication tokens.
 * Uses HS256 (HMAC-SHA256) for signing.
 */

const JWT_ALGORITHM = 'HS256'
const JWT_ISSUER = 'moneywright'
const JWT_AUDIENCE = 'moneywright-web'

// Default expiry times (can be overridden via env)
const DEFAULT_ACCESS_EXPIRY = '24h'
const DEFAULT_REFRESH_EXPIRY = '365d'

interface JWTHeader {
  alg: string
  typ: string
}

export interface AccessTokenPayload {
  sub: string // User ID
  sid: string // Session ID
  fgp: string // Fingerprint hash
  iss: string // Issuer
  aud: string // Audience
  iat: number // Issued at (seconds)
  exp: number // Expiration (seconds)
  type: 'access'
}

export interface RefreshTokenPayload {
  sub: string // User ID
  sid: string // Session ID
  fgp: string // Fingerprint hash
  iss: string // Issuer
  aud: string // Audience
  iat: number // Issued at (seconds)
  exp: number // Expiration (seconds)
  type: 'refresh'
}

export type TokenPayload = AccessTokenPayload | RefreshTokenPayload

/**
 * Get JWT secret from environment.
 * Must be at least 256 bits (32 bytes) for security.
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters (256 bits)')
  }
  return secret
}

/**
 * Parse duration string to seconds.
 * Supports: 1h, 2d, 30m, 7d, etc.
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration format: ${duration}. Use format like "1h", "7d", "30m"`)
  }

  const value = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 's':
      return value
    case 'm':
      return value * 60
    case 'h':
      return value * 60 * 60
    case 'd':
      return value * 60 * 60 * 24
    default:
      throw new Error(`Unknown duration unit: ${unit}`)
  }
}

/**
 * Get access token expiry in seconds.
 */
export function getAccessTokenExpiry(): number {
  const expiry = process.env.JWT_ACCESS_EXPIRY || DEFAULT_ACCESS_EXPIRY
  return parseDuration(expiry)
}

/**
 * Get refresh token expiry in seconds.
 */
export function getRefreshTokenExpiry(): number {
  const expiry = process.env.JWT_REFRESH_EXPIRY || DEFAULT_REFRESH_EXPIRY
  return parseDuration(expiry)
}

/**
 * Base64URL encode a string/buffer.
 */
function base64UrlEncode(data: string | Buffer): string {
  const base64 = Buffer.from(data).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Base64URL decode to string.
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

/**
 * Create HMAC-SHA256 signature.
 */
function sign(data: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(data)
  return base64UrlEncode(hmac.digest())
}

/**
 * Sign a JWT token.
 */
export function signJWT(
  payload: Omit<TokenPayload, 'iss' | 'aud' | 'iat' | 'exp'> & { exp?: number; iat?: number },
  expiresInSeconds?: number
): string {
  const secret = getJWTSecret()
  const now = Math.floor(Date.now() / 1000)

  const fullPayload: TokenPayload = {
    ...payload,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: payload.iat ?? now,
    exp:
      payload.exp ??
      now +
        (expiresInSeconds ??
          (payload.type === 'access' ? getAccessTokenExpiry() : getRefreshTokenExpiry())),
  } as TokenPayload

  const header: JWTHeader = {
    alg: JWT_ALGORITHM,
    typ: 'JWT',
  }

  const headerEncoded = base64UrlEncode(JSON.stringify(header))
  const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload))
  const signature = sign(`${headerEncoded}.${payloadEncoded}`, secret)

  return `${headerEncoded}.${payloadEncoded}.${signature}`
}

export interface VerifyResult<T = TokenPayload> {
  valid: boolean
  payload?: T
  error?: string
}

/**
 * Verify and decode a JWT token.
 * Checks signature, expiration, issuer, and audience.
 */
export function verifyJWT<T extends TokenPayload = TokenPayload>(
  token: string,
  options?: { clockTolerance?: number }
): VerifyResult<T> {
  try {
    const secret = getJWTSecret()
    const clockTolerance = options?.clockTolerance ?? 0

    const parts = token.split('.')
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' }
    }

    const headerEncoded = parts[0]!
    const payloadEncoded = parts[1]!
    const signatureEncoded = parts[2]!

    // Verify signature
    const expectedSignature = sign(`${headerEncoded}.${payloadEncoded}`, secret)
    if (expectedSignature !== signatureEncoded) {
      return { valid: false, error: 'Invalid signature' }
    }

    // Parse header and verify algorithm
    const header = JSON.parse(base64UrlDecode(headerEncoded)) as JWTHeader
    if (header.alg !== JWT_ALGORITHM) {
      return { valid: false, error: `Invalid algorithm: ${header.alg}` }
    }

    // Parse payload
    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as T

    // Verify issuer
    if (payload.iss !== JWT_ISSUER) {
      return { valid: false, error: 'Invalid issuer' }
    }

    // Verify audience
    if (payload.aud !== JWT_AUDIENCE) {
      return { valid: false, error: 'Invalid audience' }
    }

    // Verify expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now - clockTolerance) {
      return { valid: false, error: 'Token expired' }
    }

    // Verify issued at (not in the future)
    if (payload.iat > now + clockTolerance) {
      return { valid: false, error: 'Token issued in the future' }
    }

    return { valid: true, payload }
  } catch (error) {
    return {
      valid: false,
      error: `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Decode a JWT token without verification.
 * Use only for debugging or when signature has already been verified.
 */
export function decodeJWT<T extends TokenPayload = TokenPayload>(token: string): T | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const payloadEncoded = parts[1]!
    return JSON.parse(base64UrlDecode(payloadEncoded)) as T
  } catch {
    return null
  }
}
