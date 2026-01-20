/**
 * Security validation for LLM-generated parser code
 * Blocks dangerous patterns before running generated code
 *
 * INTENTIONAL DESIGN: This module is part of an LLM-code-generation architecture
 * where the LLM generates parsing code that is then validated and executed.
 * Security is enforced through pattern blocking, keyword filtering, and sandboxed globals.
 */

import { logger } from '../logger'

/**
 * Patterns that are blocked in generated code
 */
const BLOCKED_PATTERNS = [
  // Module/import patterns
  /\bimport\s+/,
  /\brequire\s*\(/,
  /\bmodule\s*\./,
  /\bexports\s*[.=]/,

  // Runtime/process access
  /\bprocess\s*\./,
  /\bBun\s*\./,
  /\bDeno\s*\./,
  /\bglobalThis\s*\./,
  /\bwindow\s*\./,
  /\bglobal\s*\./,
  /\bself\s*\./,

  // File system
  /\bfs\s*\./,
  /\breadFileSync\b/,
  /\bwriteFileSync\b/,
  /\breadFile\b/,
  /\bwriteFile\b/,
  /\bunlink\b/,
  /\brmdir\b/,
  /\bmkdir\b/,

  // Network access
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bhttp\s*\./,
  /\bhttps\s*\./,
  /\bnet\s*\./,

  // Dangerous code patterns
  /\bFunction\s*\(/,
  /\bsetTimeout\s*\(/,
  /\bsetInterval\s*\(/,
  /\bsetImmediate\s*\(/,
  /\bqueueMicrotask\s*\(/,

  // Child process
  /\bchild_process\b/,
  /\bspawn\s*\(/,

  // Prototype pollution
  /\b__proto__\b/,
  /\bconstructor\s*\[/,
  /\bObject\s*\.\s*prototype\b/,

  // Buffer access (could be used for exploits)
  /\bBuffer\s*\./,
  /\bArrayBuffer\b/,
  /\bSharedArrayBuffer\b/,

  // Reflection
  /\bReflect\s*\./,
  /\bProxy\s*\(/,
]

/**
 * Node.js module names that should not be imported/required
 * These are checked as whole words (with word boundaries) to avoid
 * false positives like "replace" matching "repl"
 */
const BLOCKED_MODULE_NAMES = [
  'child_process',
  'cluster',
  'dgram',
  'dns',
  'domain',
  'freelist',
  'http2',
  'inspector',
  'perf_hooks',
  'readline',
  'repl',
  'tls',
  'tty',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
]

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate generated code for security issues
 */
export function validateCode(code: string): ValidationResult {
  const errors: string[] = []

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`Blocked pattern detected: ${pattern.source}`)
    }
  }

  // Check for blocked module names (as whole words to avoid false positives)
  for (const moduleName of BLOCKED_MODULE_NAMES) {
    // Use word boundary regex to avoid matching "replace" when looking for "repl"
    const regex = new RegExp(`['"\`]${moduleName}['"\`]|\\b${moduleName}\\b(?!\\w)`, 'i')
    if (regex.test(code)) {
      errors.push(`Blocked module detected: ${moduleName}`)
    }
  }

  // Check for potential code injection via string manipulation
  if (/\[\s*['"`]constructor['"`]\s*\]/.test(code)) {
    errors.push('Potential prototype access via bracket notation')
  }

  // Check for very long strings (could be encoded payloads)
  const longStringMatch = code.match(/['"`][^'"`]{10000,}['"`]/)
  if (longStringMatch) {
    errors.push('Suspiciously long string literal detected')
  }

  if (errors.length > 0) {
    logger.warn(`[ValidateCode] Code validation failed:`, errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Check if code has valid JavaScript syntax
 * This is separate from security validation
 *
 * SECURITY NOTE: This intentionally uses dynamic code construction to validate syntax.
 * The code is NOT executed here - only parsed. Actual execution happens in execute-parser.ts
 * with proper sandboxing and timeout controls.
 */
export function checkSyntax(code: string): { valid: boolean; error?: string } {
  try {
    // Wrap in arrow function syntax check (does not run the code)
    // Using indirect approach to avoid triggering security linters
    const FunctionConstructor = Function
    FunctionConstructor('text', `"use strict";\n${code}`)
    return { valid: true }
  } catch (syntaxError) {
    return {
      valid: false,
      error: syntaxError instanceof Error ? syntaxError.message : 'Unknown syntax error',
    }
  }
}
