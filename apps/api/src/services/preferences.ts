import { eq, and, isNull } from 'drizzle-orm'
import { db, tables, dbType } from '../db'

/**
 * Preference keys used in the app
 */
export const PREFERENCE_KEYS = {
  DASHBOARD_EXCLUDED_CATEGORIES: 'dashboard.excluded_categories',
  DASHBOARD_CHART_TIMEFRAME: 'dashboard.chart_timeframe',
  INCOME_EXPENSES_EXCLUDED_CATEGORIES: 'dashboard.income_expenses.excluded_categories',
  SPENDING_BY_CATEGORY_EXCLUDED_CATEGORIES: 'dashboard.spending_by_category.excluded_categories',
  OLLAMA_CUSTOM_MODELS: 'llm.ollama_custom_models',
} as const

/**
 * Ollama custom model definition
 */
export interface OllamaCustomModel {
  id: string
  name: string
  supportsThinking?: boolean
}

export type PreferenceKey = (typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS]

/**
 * Get a preference value
 * If profileId is provided, looks for profile-specific preference first, then falls back to user-level
 */
export async function getPreference(
  userId: string,
  key: PreferenceKey,
  profileId?: string | null
): Promise<string | null> {
  // If profileId provided, try profile-specific first
  if (profileId) {
    const [profilePref] = await db
      .select()
      .from(tables.userPreferences)
      .where(
        and(
          eq(tables.userPreferences.userId, userId),
          eq(tables.userPreferences.profileId, profileId),
          eq(tables.userPreferences.key, key)
        )
      )
      .limit(1)

    if (profilePref) {
      return profilePref.value
    }
  }

  // Fall back to user-level preference (profileId is null)
  const [userPref] = await db
    .select()
    .from(tables.userPreferences)
    .where(
      and(
        eq(tables.userPreferences.userId, userId),
        isNull(tables.userPreferences.profileId),
        eq(tables.userPreferences.key, key)
      )
    )
    .limit(1)

  return userPref?.value || null
}

/**
 * Set a preference value
 * profileId can be null for user-level preferences
 */
export async function setPreference(
  userId: string,
  key: PreferenceKey,
  value: string,
  profileId?: string | null
): Promise<void> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Check if preference exists
  const existingConditions = [
    eq(tables.userPreferences.userId, userId),
    eq(tables.userPreferences.key, key),
  ]

  if (profileId) {
    existingConditions.push(eq(tables.userPreferences.profileId, profileId))
  } else {
    existingConditions.push(isNull(tables.userPreferences.profileId))
  }

  const [existing] = await db
    .select()
    .from(tables.userPreferences)
    .where(and(...existingConditions))
    .limit(1)

  if (existing) {
    // Update existing
    await db
      .update(tables.userPreferences)
      .set({
        value,
        updatedAt: now as Date,
      })
      .where(eq(tables.userPreferences.id, existing.id))
  } else {
    // Insert new
    await db.insert(tables.userPreferences).values({
      userId,
      profileId: profileId || null,
      key,
      value,
      createdAt: now as Date,
      updatedAt: now as Date,
    })
  }
}

/**
 * Delete a preference
 */
export async function deletePreference(
  userId: string,
  key: PreferenceKey,
  profileId?: string | null
): Promise<void> {
  const conditions = [
    eq(tables.userPreferences.userId, userId),
    eq(tables.userPreferences.key, key),
  ]

  if (profileId) {
    conditions.push(eq(tables.userPreferences.profileId, profileId))
  } else {
    conditions.push(isNull(tables.userPreferences.profileId))
  }

  await db.delete(tables.userPreferences).where(and(...conditions))
}

/**
 * Get all preferences for a user (optionally filtered by profile)
 */
export async function getAllPreferences(
  userId: string,
  profileId?: string | null
): Promise<Record<string, string>> {
  // Get user-level preferences (profileId is null)
  const userPrefs = await db
    .select()
    .from(tables.userPreferences)
    .where(and(eq(tables.userPreferences.userId, userId), isNull(tables.userPreferences.profileId)))

  const result: Record<string, string> = {}

  // Add user-level preferences
  for (const pref of userPrefs) {
    result[pref.key] = pref.value
  }

  // If profileId provided, override with profile-specific preferences
  if (profileId) {
    const profilePrefs = await db
      .select()
      .from(tables.userPreferences)
      .where(
        and(
          eq(tables.userPreferences.userId, userId),
          eq(tables.userPreferences.profileId, profileId)
        )
      )

    for (const pref of profilePrefs) {
      result[pref.key] = pref.value
    }
  }

  return result
}

/**
 * Helper: Get excluded categories for dashboard chart
 */
export async function getDashboardExcludedCategories(
  userId: string,
  profileId?: string | null
): Promise<string[]> {
  const value = await getPreference(
    userId,
    PREFERENCE_KEYS.DASHBOARD_EXCLUDED_CATEGORIES,
    profileId
  )
  if (!value) return []

  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

/**
 * Helper: Set excluded categories for dashboard chart
 */
export async function setDashboardExcludedCategories(
  userId: string,
  categories: string[],
  profileId?: string | null
): Promise<void> {
  await setPreference(
    userId,
    PREFERENCE_KEYS.DASHBOARD_EXCLUDED_CATEGORIES,
    JSON.stringify(categories),
    profileId
  )
}

/**
 * Helper: Get custom Ollama models for user
 */
export async function getOllamaCustomModels(userId: string): Promise<OllamaCustomModel[]> {
  const value = await getPreference(userId, PREFERENCE_KEYS.OLLAMA_CUSTOM_MODELS, null)
  if (!value) return []

  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

/**
 * Helper: Set custom Ollama models for user
 */
export async function setOllamaCustomModels(
  userId: string,
  models: OllamaCustomModel[]
): Promise<void> {
  await setPreference(userId, PREFERENCE_KEYS.OLLAMA_CUSTOM_MODELS, JSON.stringify(models), null)
}

/**
 * Helper: Add a custom Ollama model
 */
export async function addOllamaCustomModel(
  userId: string,
  model: OllamaCustomModel
): Promise<OllamaCustomModel[]> {
  const models = await getOllamaCustomModels(userId)

  // Check if model with same ID already exists
  const existingIndex = models.findIndex((m) => m.id === model.id)
  if (existingIndex >= 0) {
    // Update existing
    models[existingIndex] = model
  } else {
    // Add new
    models.push(model)
  }

  await setOllamaCustomModels(userId, models)
  return models
}

/**
 * Helper: Remove a custom Ollama model
 */
export async function removeOllamaCustomModel(
  userId: string,
  modelId: string
): Promise<OllamaCustomModel[]> {
  const models = await getOllamaCustomModels(userId)
  const filtered = models.filter((m) => m.id !== modelId)
  await setOllamaCustomModels(userId, filtered)
  return filtered
}
