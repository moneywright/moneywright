import { eq, and } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { Profile } from '../db'
import { isValidRelationshipType, type RelationshipType } from '../lib/constants'
import { logger } from '../lib/logger'

/**
 * Profile service
 * Handles CRUD operations for user profiles
 */

/**
 * Get all profiles for a user
 */
export async function getProfilesByUserId(userId: string): Promise<Profile[]> {
  const profiles = await db
    .select()
    .from(tables.profiles)
    .where(eq(tables.profiles.userId, userId))
    .orderBy(tables.profiles.createdAt)

  return profiles
}

/**
 * Get a profile by ID (with user ownership check)
 */
export async function getProfileById(profileId: string, userId: string): Promise<Profile | null> {
  const [profile] = await db
    .select()
    .from(tables.profiles)
    .where(and(eq(tables.profiles.id, profileId), eq(tables.profiles.userId, userId)))
    .limit(1)

  return profile || null
}

/**
 * Create a new profile
 */
export async function createProfile(data: {
  userId: string
  name: string
  relationship?: string | null
  isDefault?: boolean
}): Promise<Profile> {
  // Validate name length
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Profile name is required')
  }

  if (data.name.length > 50) {
    throw new Error('Profile name must be 50 characters or less')
  }

  // Validate relationship type if provided
  if (data.relationship && !isValidRelationshipType(data.relationship)) {
    throw new Error(`Invalid relationship type: ${data.relationship}`)
  }

  // Check for duplicate name
  const [existingProfile] = await db
    .select()
    .from(tables.profiles)
    .where(and(eq(tables.profiles.userId, data.userId), eq(tables.profiles.name, data.name.trim())))
    .limit(1)

  if (existingProfile) {
    throw new Error('A profile with this name already exists')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // If this profile should be default, unset any existing default
  if (data.isDefault) {
    await db
      .update(tables.profiles)
      .set({ isDefault: false, updatedAt: now as Date })
      .where(and(eq(tables.profiles.userId, data.userId), eq(tables.profiles.isDefault, true)))
  }

  const [profile] = await db
    .insert(tables.profiles)
    .values({
      userId: data.userId,
      name: data.name.trim(),
      relationship: (data.relationship as RelationshipType) || null,
      isDefault: data.isDefault || false,
      createdAt: now as Date,
      updatedAt: now as Date,
    })
    .returning()

  if (!profile) {
    throw new Error('Failed to create profile')
  }

  logger.debug(`[Profile] Created profile ${profile.id} for user ${data.userId}`)
  return profile
}

/**
 * Update a profile
 */
export async function updateProfile(
  profileId: string,
  userId: string,
  data: {
    name?: string
    relationship?: string | null
    isDefault?: boolean
  }
): Promise<Profile> {
  // Verify ownership
  const existingProfile = await getProfileById(profileId, userId)
  if (!existingProfile) {
    throw new Error('Profile not found')
  }

  // Validate name if provided
  if (data.name !== undefined) {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Profile name is required')
    }

    if (data.name.length > 50) {
      throw new Error('Profile name must be 50 characters or less')
    }

    // Check for duplicate name (excluding current profile)
    const [duplicateProfile] = await db
      .select()
      .from(tables.profiles)
      .where(
        and(
          eq(tables.profiles.userId, userId),
          eq(tables.profiles.name, data.name.trim())
          // Note: we need to exclude current profile - done via ID check
        )
      )
      .limit(1)

    if (duplicateProfile && duplicateProfile.id !== profileId) {
      throw new Error('A profile with this name already exists')
    }
  }

  // Validate relationship type if provided
  if (data.relationship !== undefined && data.relationship !== null) {
    if (!isValidRelationshipType(data.relationship)) {
      throw new Error(`Invalid relationship type: ${data.relationship}`)
    }
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // If this profile should be default, unset any existing default
  if (data.isDefault) {
    await db
      .update(tables.profiles)
      .set({ isDefault: false, updatedAt: now as Date })
      .where(and(eq(tables.profiles.userId, userId), eq(tables.profiles.isDefault, true)))
  }

  // Build update object
  const updateData: Partial<Profile> = {
    updatedAt: now as Date,
  }

  if (data.name !== undefined) {
    updateData.name = data.name.trim()
  }

  if (data.relationship !== undefined) {
    updateData.relationship = (data.relationship as RelationshipType) || null
  }

  if (data.isDefault !== undefined) {
    updateData.isDefault = data.isDefault
  }

  const [updatedProfile] = await db
    .update(tables.profiles)
    .set(updateData)
    .where(eq(tables.profiles.id, profileId))
    .returning()

  if (!updatedProfile) {
    throw new Error('Failed to update profile')
  }

  logger.debug(`[Profile] Updated profile ${profileId}`)
  return updatedProfile
}

/**
 * Delete a profile (hard delete - cascades to all associated data)
 */
export async function deleteProfile(profileId: string, userId: string): Promise<void> {
  // Verify ownership
  const existingProfile = await getProfileById(profileId, userId)
  if (!existingProfile) {
    throw new Error('Profile not found')
  }

  await db.delete(tables.profiles).where(eq(tables.profiles.id, profileId))

  logger.debug(`[Profile] Deleted profile ${profileId}`)
}

/**
 * Get the default profile for a user (or first profile if no default)
 */
export async function getDefaultProfile(userId: string): Promise<Profile | null> {
  // Try to get the default profile
  const [defaultProfile] = await db
    .select()
    .from(tables.profiles)
    .where(and(eq(tables.profiles.userId, userId), eq(tables.profiles.isDefault, true)))
    .limit(1)

  if (defaultProfile) {
    return defaultProfile
  }

  // If no default, return the first profile
  const [firstProfile] = await db
    .select()
    .from(tables.profiles)
    .where(eq(tables.profiles.userId, userId))
    .orderBy(tables.profiles.createdAt)
    .limit(1)

  return firstProfile || null
}

/**
 * Get profile count for a user
 */
export async function getProfileCount(userId: string): Promise<number> {
  const profiles = await db
    .select({ id: tables.profiles.id })
    .from(tables.profiles)
    .where(eq(tables.profiles.userId, userId))

  return profiles.length
}
