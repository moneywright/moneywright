/**
 * PIN Authentication Service
 * Handles PIN setup, verification, and recovery for local mode
 */

import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db, dbType, tables } from '../db'
import { logger } from '../lib/logger'

const PIN_CONFIG_ID = 'default'
const BCRYPT_ROUNDS = 12

/**
 * Helper to format dates for database (handles SQLite vs Postgres)
 */
function formatDateForDb(date: Date | null): Date | string | null {
  if (date === null) return null
  return dbType === 'postgres' ? date : date.toISOString()
}

/**
 * Helper to get current timestamp for database updates
 */
function getNowForDb(): Date | string {
  const now = new Date()
  return dbType === 'postgres' ? now : now.toISOString()
}

/**
 * Lockout configuration
 * Progressive delays based on failed attempts
 */
const LOCKOUT_CONFIG = {
  3: 30, // 30 seconds after 3 failures
  5: 5 * 60, // 5 minutes after 5 failures
  10: 30 * 60, // 30 minutes after 10 failures
} as const

/**
 * Generate a backup code in format XXXX-XXXX-XXXX
 */
export function generateBackupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars: I, O, 0, 1
  let code = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Check if PIN is configured
 */
export async function isPinConfigured(): Promise<boolean> {
  const config = await db
    .select({ id: tables.pinConfig.id })
    .from(tables.pinConfig)
    .where(eq(tables.pinConfig.id, PIN_CONFIG_ID))
    .limit(1)

  return config.length > 0
}

/**
 * Get PIN config (internal use)
 */
async function getPinConfig() {
  const configs = await db
    .select()
    .from(tables.pinConfig)
    .where(eq(tables.pinConfig.id, PIN_CONFIG_ID))
    .limit(1)

  return configs[0] || null
}

/**
 * Calculate lockout duration based on failed attempts
 */
function getLockoutDuration(failedAttempts: number): number {
  let duration = 0
  for (const [threshold, seconds] of Object.entries(LOCKOUT_CONFIG)) {
    if (failedAttempts >= parseInt(threshold)) {
      duration = seconds
    }
  }
  return duration
}

/**
 * Check if currently locked out
 * Returns { locked: boolean, retryAfter?: number, attemptsRemaining?: number }
 */
export async function checkLockout(): Promise<{
  locked: boolean
  retryAfter?: number
  attemptsRemaining?: number
}> {
  const config = await getPinConfig()
  if (!config) {
    return { locked: false }
  }

  const now = new Date()
  const lockedUntil = config.lockedUntil ? new Date(config.lockedUntil) : null

  if (lockedUntil && lockedUntil > now) {
    const retryAfter = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)
    return { locked: true, retryAfter }
  }

  // Calculate attempts remaining until next lockout tier
  const failedAttempts = config.failedAttempts
  let attemptsRemaining = 3 - failedAttempts // First lockout at 3

  if (failedAttempts >= 3) attemptsRemaining = 5 - failedAttempts
  if (failedAttempts >= 5) attemptsRemaining = 10 - failedAttempts
  if (failedAttempts >= 10) attemptsRemaining = 1 // Always 1 more try after 30 min

  return { locked: false, attemptsRemaining: Math.max(1, attemptsRemaining) }
}

/**
 * Record a failed attempt and apply lockout if needed
 */
async function recordFailedAttempt(): Promise<{ retryAfter?: number; attemptsRemaining: number }> {
  const config = await getPinConfig()
  if (!config) {
    return { attemptsRemaining: 3 }
  }

  const newFailedAttempts = config.failedAttempts + 1
  const lockoutDuration = getLockoutDuration(newFailedAttempts)

  const lockedUntilDate = lockoutDuration > 0 ? new Date(Date.now() + lockoutDuration * 1000) : null

  await db
    .update(tables.pinConfig)
    .set({
      failedAttempts: newFailedAttempts,
      lockedUntil: formatDateForDb(lockedUntilDate) as Date | null,
      updatedAt: getNowForDb() as Date,
    })
    .where(eq(tables.pinConfig.id, PIN_CONFIG_ID))

  // Calculate attempts remaining
  let attemptsRemaining = 3 - newFailedAttempts
  if (newFailedAttempts >= 3) attemptsRemaining = 5 - newFailedAttempts
  if (newFailedAttempts >= 5) attemptsRemaining = 10 - newFailedAttempts
  if (newFailedAttempts >= 10) attemptsRemaining = 1

  return {
    retryAfter: lockoutDuration > 0 ? lockoutDuration : undefined,
    attemptsRemaining: Math.max(0, attemptsRemaining),
  }
}

/**
 * Reset failed attempts on successful verification
 */
async function resetFailedAttempts(): Promise<void> {
  await db
    .update(tables.pinConfig)
    .set({
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: getNowForDb() as Date,
    })
    .where(eq(tables.pinConfig.id, PIN_CONFIG_ID))
}

/**
 * Setup PIN for the first time
 * Returns the backup code (only shown once)
 */
export async function setupPin(pin: string): Promise<{ backupCode: string }> {
  // Validate PIN format
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be exactly 6 digits')
  }

  // Check if PIN is already configured
  const existing = await isPinConfigured()
  if (existing) {
    throw new Error('PIN is already configured')
  }

  // Hash PIN and generate backup code
  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS)
  const backupCode = generateBackupCode()
  const backupCodeHash = await bcrypt.hash(backupCode, BCRYPT_ROUNDS)

  // Store in database
  await db.insert(tables.pinConfig).values({
    id: PIN_CONFIG_ID,
    pinHash,
    backupCodeHash,
    failedAttempts: 0,
    lockedUntil: null,
  })

  logger.info('[PIN] PIN configured successfully')
  return { backupCode }
}

/**
 * Verify PIN
 * Returns { success: true } or { success: false, error, retryAfter?, attemptsRemaining? }
 */
export async function verifyPin(pin: string): Promise<{
  success: boolean
  error?: string
  retryAfter?: number
  attemptsRemaining?: number
}> {
  // Check lockout first
  const lockoutStatus = await checkLockout()
  if (lockoutStatus.locked) {
    return {
      success: false,
      error: 'too_many_attempts',
      retryAfter: lockoutStatus.retryAfter,
    }
  }

  const config = await getPinConfig()
  if (!config) {
    return { success: false, error: 'pin_not_configured' }
  }

  // Verify PIN
  const isValid = await bcrypt.compare(pin, config.pinHash)

  if (!isValid) {
    const result = await recordFailedAttempt()
    return {
      success: false,
      error: 'invalid_pin',
      retryAfter: result.retryAfter,
      attemptsRemaining: result.attemptsRemaining,
    }
  }

  // Success - reset failed attempts
  await resetFailedAttempts()
  logger.info('[PIN] PIN verified successfully')
  return { success: true }
}

/**
 * Recover using backup code and set new PIN
 * Returns new backup code
 */
export async function recoverWithBackupCode(
  backupCode: string,
  newPin: string
): Promise<{
  success: boolean
  backupCode?: string
  error?: string
  retryAfter?: number
  attemptsRemaining?: number
}> {
  // Validate new PIN format
  if (!/^\d{6}$/.test(newPin)) {
    return { success: false, error: 'PIN must be exactly 6 digits' }
  }

  // Check lockout first
  const lockoutStatus = await checkLockout()
  if (lockoutStatus.locked) {
    return {
      success: false,
      error: 'too_many_attempts',
      retryAfter: lockoutStatus.retryAfter,
    }
  }

  const config = await getPinConfig()
  if (!config) {
    return { success: false, error: 'pin_not_configured' }
  }

  // Normalize backup code (remove dashes, uppercase)
  const normalizedCode = backupCode.replace(/-/g, '').toUpperCase()
  const formattedCode = `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4, 8)}-${normalizedCode.slice(8, 12)}`

  // Verify backup code
  const isValid = await bcrypt.compare(formattedCode, config.backupCodeHash)

  if (!isValid) {
    const result = await recordFailedAttempt()
    return {
      success: false,
      error: 'invalid_backup_code',
      retryAfter: result.retryAfter,
      attemptsRemaining: result.attemptsRemaining,
    }
  }

  // Generate new PIN hash and backup code
  const pinHash = await bcrypt.hash(newPin, BCRYPT_ROUNDS)
  const newBackupCode = generateBackupCode()
  const backupCodeHash = await bcrypt.hash(newBackupCode, BCRYPT_ROUNDS)

  // Update database
  await db
    .update(tables.pinConfig)
    .set({
      pinHash,
      backupCodeHash,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: getNowForDb() as Date,
    })
    .where(eq(tables.pinConfig.id, PIN_CONFIG_ID))

  logger.info('[PIN] PIN recovered successfully')
  return { success: true, backupCode: newBackupCode }
}

/**
 * Change PIN (requires current PIN verification)
 */
export async function changePin(
  currentPin: string,
  newPin: string
): Promise<{
  success: boolean
  error?: string
}> {
  // Validate new PIN format
  if (!/^\d{6}$/.test(newPin)) {
    return { success: false, error: 'PIN must be exactly 6 digits' }
  }

  const config = await getPinConfig()
  if (!config) {
    return { success: false, error: 'pin_not_configured' }
  }

  // Verify current PIN
  const isValid = await bcrypt.compare(currentPin, config.pinHash)
  if (!isValid) {
    return { success: false, error: 'invalid_current_pin' }
  }

  // Hash and store new PIN
  const pinHash = await bcrypt.hash(newPin, BCRYPT_ROUNDS)
  await db
    .update(tables.pinConfig)
    .set({
      pinHash,
      updatedAt: getNowForDb() as Date,
    })
    .where(eq(tables.pinConfig.id, PIN_CONFIG_ID))

  logger.info('[PIN] PIN changed successfully')
  return { success: true }
}

/**
 * Regenerate backup code (requires valid session)
 */
export async function regenerateBackupCode(): Promise<{
  success: boolean
  backupCode?: string
  error?: string
}> {
  const config = await getPinConfig()
  if (!config) {
    return { success: false, error: 'pin_not_configured' }
  }

  // Generate new backup code
  const newBackupCode = generateBackupCode()
  const backupCodeHash = await bcrypt.hash(newBackupCode, BCRYPT_ROUNDS)

  // Update database
  await db
    .update(tables.pinConfig)
    .set({
      backupCodeHash,
      updatedAt: getNowForDb() as Date,
    })
    .where(eq(tables.pinConfig.id, PIN_CONFIG_ID))

  logger.info('[PIN] Backup code regenerated')
  return { success: true, backupCode: newBackupCode }
}
