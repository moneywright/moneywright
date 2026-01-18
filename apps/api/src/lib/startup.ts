/**
 * Startup utilities
 * Handles environment detection, .env auto-generation, and app directory resolution
 */

import { existsSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Detect if running as a compiled Bun binary (internal use only)
 */
function isCompiledBinary(): boolean {
  // Compiled binary has a custom executable name, not 'bun'
  const execName = process.execPath.split('/').pop() || ''
  return execName !== 'bun' && !execName.startsWith('bun')
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.APP_ENV === 'development'
}

/**
 * Check if authentication is enabled
 * Default is false (local mode)
 */
export function isAuthEnabled(): boolean {
  return process.env.AUTH_ENABLED === 'true'
}

/**
 * Check if a display is available for opening browser
 * Returns true on macOS/Windows, or Linux with DISPLAY set
 */
export function hasDisplay(): boolean {
  const platform = process.platform
  if (platform === 'darwin' || platform === 'win32') {
    return true
  }
  // Linux: check for DISPLAY or WAYLAND_DISPLAY environment variable
  return !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY)
}

/**
 * Try to open a URL in the default browser
 * Only works if a display is available
 */
export function openBrowser(url: string): void {
  if (!hasDisplay()) {
    return
  }

  const platform = process.platform

  try {
    if (platform === 'darwin') {
      Bun.spawn(['open', url])
    } else if (platform === 'win32') {
      Bun.spawn(['cmd', '/c', 'start', url])
    } else {
      // Linux and others
      Bun.spawn(['xdg-open', url])
    }
  } catch {
    // Silently fail if browser can't be opened
  }
}

/**
 * Get the application directory
 * - For compiled binary: directory where binary is located
 * - For Docker/production: current working directory (/usr/src/app)
 * - For development: the source directory
 */
export function getAppDir(): string {
  if (isCompiledBinary()) {
    return dirname(process.execPath)
  }
  // In production (Docker or any non-development), use CWD where public/ is located
  if (!isDevelopment()) {
    return process.cwd()
  }
  return import.meta.dir
}

/**
 * Generate a cryptographically secure random base64 string
 */
function generateRandomBase64(bytes: number): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('base64')
}

/**
 * Generate a cryptographically secure random hex string
 */
function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('hex')
}

/**
 * Parse a .env file content into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) continue

    const key = trimmed.slice(0, equalIndex).trim()
    let value = trimmed.slice(equalIndex + 1).trim()

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

/**
 * Initialize environment for compiled binary
 * - Auto-generates .env with secure secrets if missing
 * - Loads .env from binary directory (not CWD)
 */
export function initializeBinaryEnvironment(): void {
  if (!isCompiledBinary()) {
    return // Only run for compiled binaries
  }

  const appDir = getAppDir()
  const envPath = join(appDir, '.env')

  // Auto-generate .env if it doesn't exist
  if (!existsSync(envPath)) {
    console.log('\n========================================')
    console.log('  First Run - Generating Secure Config')
    console.log('========================================\n')

    const jwtSecret = generateRandomBase64(32)
    const encryptionKey = generateRandomHex(32)

    const envContent = `# App Configuration
# Auto-generated on: ${new Date().toISOString()}

# JWT secret for signing auth tokens (auto-generated, do not share)
JWT_SECRET=${jwtSecret}

# Encryption key for sensitive data (auto-generated, do not share)
ENCRYPTION_KEY=${encryptionKey}

# Server port (default: 7777)
PORT=7777

# Google OAuth credentials
# Configure via http://localhost:7777/setup or uncomment and set here:
# GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=your-client-secret

# App URL - used for OAuth redirect URI
# Uncomment and set if running behind a reverse proxy or custom domain:
# APP_URL=https://your-domain.com
`

    writeFileSync(envPath, envContent, 'utf-8')
    console.log(`  Created: ${envPath}`)
    console.log('  Secure secrets generated automatically.\n')
  }

  // Load .env from binary directory into process.env
  // This ensures the binary works regardless of where it's run from
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    const envVars = parseEnvFile(content)

    for (const [key, value] of Object.entries(envVars)) {
      // Don't override existing env vars (allows CLI overrides)
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
}
