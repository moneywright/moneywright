/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth
 */

import { createHash, randomBytes } from 'crypto'

/**
 * Generate a PKCE code verifier and challenge pair
 */
export function generatePKCEPair(): { verifier: string; challenge: string } {
  // Generate random verifier (43-128 characters)
  const verifier = randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Generate challenge using SHA-256
  const challenge = createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return { verifier, challenge }
}
