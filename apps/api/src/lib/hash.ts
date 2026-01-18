/**
 * Hash utilities for security operations
 */

import { createHash } from 'crypto'

/**
 * Generate a random string
 */
export function generateRandomString(
  length: number,
  encoding: 'hex' | 'base64url' = 'hex'
): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  if (encoding === 'base64url') {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }
  return Buffer.from(bytes).toString('hex')
}

/**
 * Generate a fingerprint (random string and its hash)
 */
export function generateFingerprint(): { raw: string; hash: string } {
  const raw = generateRandomString(32, 'base64url')
  const hash = createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

/**
 * Verify a fingerprint against its hash
 */
export function verifyFingerprint(raw: string, hash: string): boolean {
  const computed = createHash('sha256').update(raw).digest('hex')
  return computed === hash
}

/**
 * Hash a refresh token for storage
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Create a hash for logging (first 8 chars only for privacy)
 */
export function hashForLog(value: string): string {
  const hash = createHash('sha256').update(value).digest('hex')
  return hash.slice(0, 8)
}
