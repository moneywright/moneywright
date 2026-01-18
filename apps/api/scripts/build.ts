/**
 * Build script for the API
 * Bundles the API into a single file for production
 */

import { join } from 'path'

const rootDir = join(import.meta.dir, '..')
const distDir = join(rootDir, 'dist')

console.log('Building API...')

const result = await Bun.build({
  entrypoints: [join(rootDir, 'src/index.ts')],
  outdir: distDir,
  target: 'bun',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
  external: ['better-sqlite3', 'postgres'],
})

if (!result.success) {
  console.error('Build failed:')
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.log('Build complete!')
console.log(`Output: ${distDir}`)
