/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }
  if (!/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string')
  }
  return Buffer.from(key, 'hex')
}

/**
 * Encrypt a string value
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let ciphertext = cipher.update(plaintext, 'utf8')
  ciphertext = Buffer.concat([ciphertext, cipher.final()])
  const authTag = cipher.getAuthTag()

  // Concatenate: iv + authTag + ciphertext
  const result = Buffer.concat([iv, authTag, ciphertext])
  return result.toString('base64')
}

/**
 * Decrypt an encrypted value
 * Input: base64(iv + authTag + ciphertext)
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey()
  const data = Buffer.from(encrypted, 'base64')

  // Extract parts
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let plaintext = decipher.update(ciphertext)
  plaintext = Buffer.concat([plaintext, decipher.final()])

  return plaintext.toString('utf8')
}

/**
 * Check if encryption is configured
 */
export function isEncryptionConfigured(): boolean {
  const key = process.env.ENCRYPTION_KEY
  return !!key && /^[a-fA-F0-9]{64}$/.test(key)
}

/**
 * Encrypt a value if it's not null/undefined
 * Useful for optional fields
 */
export function encryptOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return encrypt(value)
}

/**
 * Decrypt a value if it's not null/undefined
 * Useful for optional fields
 */
export function decryptOptional(encrypted: string | null | undefined): string | null {
  if (encrypted === null || encrypted === undefined) {
    return null
  }
  return decrypt(encrypted)
}

/**
 * Generate a new random encryption key (for initial setup)
 * Returns a 64-character hex string
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}
