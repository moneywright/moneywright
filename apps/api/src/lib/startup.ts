/**
 * Startup utilities
 * Handles environment detection, .env auto-generation, and app directory resolution
 *
 * Deployment modes:
 * 1. Desktop sidecar - Tauri app sets DATA_DIR, binary reads/writes data there
 * 2. Standalone binary - Data stored next to the binary
 * 3. Development/Docker/Cloud - Direct bun execution, uses DATABASE_URL or local SQLite
 */

import { existsSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Normalize Windows extended-length path prefix (\\?\)
 * This prefix can cause issues with some file operations in Node.js/Bun
 */
export function normalizePath(p: string): string {
  if (p.startsWith('\\\\?\\')) {
    return p.slice(4)
  }
  return p
}

/**
 * Check if running as a compiled Bun binary
 * True for standalone binary and desktop sidecar
 * False for development (bun run) and Docker (bun start)
 */
export function isCompiledBinary(): boolean {
  const execName = process.execPath.split('/').pop() || ''
  return execName !== 'bun' && !execName.startsWith('bun')
}

/**
 * Check if running as desktop sidecar
 * The Tauri app sets DATA_DIR to tell the sidecar where to store data
 */
export function isDesktopSidecar(): boolean {
  return !!process.env.DATA_DIR
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.APP_ENV === 'development'
}

/**
 * Check if running on localhost (HTTP, not HTTPS)
 * Used for cookie security - localhost doesn't support Secure cookies over HTTP
 *
 * Returns true if:
 * - Development mode (APP_ENV=development)
 * - Desktop sidecar (DATA_DIR set)
 * - APP_URL contains localhost or 127.0.0.1 (or not set, defaults to localhost)
 */
export function isLocalhost(): boolean {
  if (isDevelopment()) return true
  if (isDesktopSidecar()) return true

  // Check APP_URL - defaults to localhost if not set
  const appUrl = process.env.APP_URL || 'http://localhost:17777'
  return appUrl.includes('localhost') || appUrl.includes('127.0.0.1')
}

/**
 * Check if authentication is enabled
 * Default is false (local mode with auto-login)
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
 * Get the data directory for storing app data (.env, database, etc.)
 * - Desktop sidecar: DATA_DIR (set by Tauri)
 * - Standalone binary: directory where binary is located
 * - Development/Docker: current working directory
 */
export function getDataDir(): string {
  // Desktop sidecar: Tauri sets DATA_DIR
  if (process.env.DATA_DIR) {
    return normalizePath(process.env.DATA_DIR)
  }

  // Standalone binary: use binary directory
  if (isCompiledBinary()) {
    return dirname(process.execPath)
  }

  // Development/Docker: use current working directory
  return process.cwd()
}

/**
 * Get the application directory (where code/assets are located)
 * - Compiled binary: directory where binary is located
 * - Docker/production: current working directory
 * - Development: the source directory
 */
export function getAppDir(): string {
  if (isCompiledBinary()) {
    return dirname(process.execPath)
  }
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
 * - Loads .env from data directory
 */
export function initializeBinaryEnvironment(): void {
  if (!isCompiledBinary()) {
    return // Only run for compiled binaries
  }

  const dataDir = getDataDir()
  const envPath = join(dataDir, '.env')

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

# Server port (default: 17777)
PORT=17777

# Google OAuth credentials
# Configure via http://localhost:17777/setup or uncomment and set here:
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

  // Load .env into process.env
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
