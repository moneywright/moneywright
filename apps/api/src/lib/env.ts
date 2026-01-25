/**
 * Environment variable validation
 * Validates required environment variables at startup
 */

interface EnvConfig {
  // Required for app to function
  JWT_SECRET: string
  ENCRYPTION_KEY: string

  // Optional - can be configured via UI instead of env
  GOOGLE_CLIENT_ID: string | undefined
  GOOGLE_CLIENT_SECRET: string | undefined

  // Optional with defaults
  APP_URL: string // Public-facing URL (for OAuth redirect and CORS)
  PORT: number
  JWT_ACCESS_EXPIRY: string
  JWT_REFRESH_EXPIRY: string

  // Optional (have fallbacks)
  DATABASE_URL: string | undefined
}

// Only JWT_SECRET and ENCRYPTION_KEY are truly required at startup
// Google credentials can be configured via /setup UI
const REQUIRED_VARS = ['JWT_SECRET', 'ENCRYPTION_KEY'] as const

/**
 * Validate all required environment variables are set
 * Exits the process with error code 1 if validation fails
 */
export function validateEnv(): void {
  const missing: string[] = []
  const invalid: string[] = []

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName]
    if (!value || value.trim() === '') {
      missing.push(varName)
    }
  }

  // Validate JWT_SECRET length (must be at least 32 characters for 256-bit security)
  const jwtSecret = process.env.JWT_SECRET
  if (jwtSecret && jwtSecret.length < 32) {
    invalid.push(`JWT_SECRET must be at least 32 characters (got ${jwtSecret.length})`)
  }

  // Validate ENCRYPTION_KEY format (should be 64 hex characters = 32 bytes)
  const encryptionKey = process.env.ENCRYPTION_KEY
  if (encryptionKey && !/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
    invalid.push('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }

  // Report errors and exit if any
  if (missing.length > 0 || invalid.length > 0) {
    console.error('\n========================================')
    console.error('  ENVIRONMENT CONFIGURATION ERROR')
    console.error('========================================\n')

    if (missing.length > 0) {
      console.error('Missing required environment variables:')
      for (const varName of missing) {
        console.error(`  - ${varName}`)
      }
      console.error('')
    }

    if (invalid.length > 0) {
      console.error('Invalid environment variables:')
      for (const msg of invalid) {
        console.error(`  - ${msg}`)
      }
      console.error('')
    }

    console.error('Please check your .env file or environment configuration.')
    console.error('See .env.example for required variables.\n')
    console.error('========================================\n')

    process.exit(1)
  }
}

/**
 * Get validated environment configuration
 * Call validateEnv() first to ensure all required vars are set
 */
export function getEnv(): EnvConfig {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 17777

  return {
    JWT_SECRET: process.env.JWT_SECRET!,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
    // Google credentials are optional at env level - can be set via UI
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    APP_URL: process.env.APP_URL || `http://localhost:${port}`,
    PORT: port,
    JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '1h',
    JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
    DATABASE_URL: process.env.DATABASE_URL,
  }
}
