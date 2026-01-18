/**
 * ID generation utilities
 */

import { nanoid as createNanoid } from 'nanoid'

/**
 * Generate a unique ID (21 characters by default)
 */
export function nanoid(size?: number): string {
  return createNanoid(size)
}
