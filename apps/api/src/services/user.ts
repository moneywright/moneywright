import { eq } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { User } from '../db'
import { DEFAULT_USER_ID, isValidCountryCode, type CountryCode } from '../lib/constants'
import { logger } from '../lib/logger'
import { isAuthEnabled } from '../lib/startup'

/**
 * User service
 * Handles user operations including onboarding and default user management
 */

/**
 * Ensure the default user exists (for local mode)
 * Called during app startup when AUTH_ENABLED=false
 */
export async function ensureDefaultUser(): Promise<User> {
  // Check if default user already exists
  const [existingUser] = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, DEFAULT_USER_ID))
    .limit(1)

  if (existingUser) {
    logger.debug('[User] Default user already exists')
    return existingUser
  }

  // Create default user
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [user] = await db
    .insert(tables.users)
    .values({
      id: DEFAULT_USER_ID,
      email: null,
      name: 'Local User',
      googleId: null,
      picture: null,
      country: null,
      createdAt: now as Date,
      updatedAt: now as Date,
    })
    .returning()

  if (!user) {
    throw new Error('Failed to create default user')
  }

  logger.info('[User] Created default user for local mode')
  return user
}

/**
 * Find user by ID
 */
export async function findUserById(userId: string): Promise<User | null> {
  const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1)

  return user || null
}

/**
 * Update user's country (onboarding step)
 */
export async function updateUserCountry(userId: string, country: string): Promise<User> {
  if (!isValidCountryCode(country)) {
    throw new Error(`Invalid country code: ${country}`)
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [updatedUser] = await db
    .update(tables.users)
    .set({
      country: country as CountryCode,
      updatedAt: now as Date,
    })
    .where(eq(tables.users.id, userId))
    .returning()

  if (!updatedUser) {
    throw new Error('User not found')
  }

  logger.debug(`[User] Updated country for user ${userId} to ${country}`)
  return updatedUser
}

/**
 * Check if user has completed onboarding
 * Onboarding is complete when country is set and at least one profile exists
 */
export async function isOnboardingComplete(userId: string): Promise<{
  complete: boolean
  missingStep: 'country' | 'profile' | null
}> {
  const user = await findUserById(userId)

  if (!user) {
    return { complete: false, missingStep: 'country' }
  }

  if (!user.country) {
    return { complete: false, missingStep: 'country' }
  }

  // Check if user has at least one profile
  const [profileCount] = await db
    .select({ count: tables.profiles.id })
    .from(tables.profiles)
    .where(eq(tables.profiles.userId, userId))
    .limit(1)

  if (!profileCount) {
    return { complete: false, missingStep: 'profile' }
  }

  return { complete: true, missingStep: null }
}

/**
 * Get auth status response for frontend
 */
export async function getAuthStatus(userId: string | null): Promise<{
  authEnabled: boolean
  authenticated: boolean
  user: {
    id: string
    email: string | null
    name: string | null
    picture: string | null
    country: string | null
    onboardingComplete: boolean
  } | null
}> {
  const authEnabled = isAuthEnabled()

  if (!userId) {
    return {
      authEnabled,
      authenticated: false,
      user: null,
    }
  }

  const user = await findUserById(userId)

  if (!user) {
    return {
      authEnabled,
      authenticated: false,
      user: null,
    }
  }

  const { complete } = await isOnboardingComplete(userId)

  return {
    authEnabled,
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      country: user.country,
      onboardingComplete: complete,
    },
  }
}
