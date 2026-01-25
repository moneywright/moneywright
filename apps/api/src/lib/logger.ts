import { isDevelopment } from './startup'

/**
 * Simple logger with environment-aware log levels.
 *
 * Log levels:
 * - debug: Only shown in development or when ENABLE_LOGGING=true
 * - info: Always shown (essential production info)
 * - warn: Always shown
 * - error: Always shown
 */

function isLoggingEnabled(): boolean {
  return isDevelopment() || process.env.ENABLE_LOGGING === 'true'
}

export const logger = {
  /** Debug logs - only shown in development or when ENABLE_LOGGING=true */
  debug: (...args: unknown[]) => {
    if (isLoggingEnabled()) console.log(...args)
  },

  /** Info logs - always shown (essential production info) */
  info: (...args: unknown[]) => {
    console.log(...args)
  },

  /** Warning logs - always shown */
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },

  /** Error logs - always shown */
  error: (...args: unknown[]) => {
    console.error(...args)
  },
}
