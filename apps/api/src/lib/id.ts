/**
 * ID generation utilities
 */

import { customAlphabet } from 'nanoid'

/**
 * Custom alphabet without - and _ to avoid issues with:
 * - IDs starting with - being interpreted as CLI flags
 * - Potential parsing issues in various contexts
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/**
 * Create nanoid generator with custom alphabet
 */
const createId = customAlphabet(ALPHABET, 21)

/**
 * Generate a unique ID (21 characters by default)
 * Uses alphanumeric characters only (no - or _)
 */
export function nanoid(size?: number): string {
  if (size) {
    return customAlphabet(ALPHABET, size)()
  }
  return createId()
}
