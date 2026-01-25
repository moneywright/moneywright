import { isDevelopment, isDesktopSidecar } from './startup'

/**
 * Simple logger with environment-aware log levels.
 *
 * Log levels:
 * - debug: Only shown in development, desktop sidecar, or when ENABLE_LOGGING=true
 * - info: Always shown (essential production info)
 * - warn: Always shown
 * - error: Always shown
 */

function isLoggingEnabled(): boolean {
  return isDevelopment() || isDesktopSidecar() || process.env.ENABLE_LOGGING === 'true'
}

/**
 * Format args for logging (similar to console.log behavior)
 */
function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      if (arg instanceof Error) return `${arg.message}\n${arg.stack}`
      try {
        return JSON.stringify(arg, null, 2)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

// Create persistent writers for stdout/stderr with explicit flushing
const stdoutWriter = Bun.stdout.writer()
const stderrWriter = Bun.stderr.writer()

/**
 * Write to stdout with immediate flush (for sidecar log capture)
 */
function writeLog(args: unknown[]): void {
  const message = formatArgs(args) + '\n'
  stdoutWriter.write(message)
  stdoutWriter.flush()
}

/**
 * Write to stderr with immediate flush
 */
function writeError(args: unknown[]): void {
  const message = formatArgs(args) + '\n'
  stderrWriter.write(message)
  stderrWriter.flush()
}

export const logger = {
  /** Debug logs - only shown in development, desktop sidecar, or when ENABLE_LOGGING=true */
  debug: (...args: unknown[]) => {
    if (isLoggingEnabled()) writeLog(args)
  },

  /** Info logs - always shown (essential production info) */
  info: (...args: unknown[]) => {
    writeLog(args)
  },

  /** Warning logs - always shown */
  warn: (...args: unknown[]) => {
    writeError(args)
  },

  /** Error logs - always shown */
  error: (...args: unknown[]) => {
    writeError(args)
  },
}
