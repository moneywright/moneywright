/**
 * PDF.js worker setup for Bun binary builds
 *
 * pdfjs-dist tries to dynamically import './pdf.worker.mjs' at runtime which
 * fails in bundled binaries with "Cannot find module './pdf.worker.mjs'".
 *
 * This file pre-loads the WorkerMessageHandler and sets it on globalThis.pdfjsWorker
 * so that pdfjs uses it directly without trying to dynamically import the worker.
 *
 * IMPORT ORDER IS CRITICAL:
 * 1. canvas-polyfill.ts (sets up DOMMatrix, ImageData, Path2D)
 * 2. This file (sets up pdfjsWorker)
 * 3. Any code that uses pdf-parse
 */

// Import the worker module - Bun will bundle this into the binary
// @ts-expect-error - Worker module doesn't have type declarations
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'

// Set on globalThis so pdfjs finds it without dynamic import
// pdfjs checks globalThis.pdfjsWorker?.WorkerMessageHandler before trying to import
// @ts-expect-error - Setting global for pdfjs-dist
globalThis.pdfjsWorker = pdfjsWorker

export {}
