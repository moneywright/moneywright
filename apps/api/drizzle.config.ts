import { defineConfig } from 'drizzle-kit'

// Determine database type from environment
const DATABASE_URL = process.env.DATABASE_URL
const isPostgres = !!DATABASE_URL

export default defineConfig(
  isPostgres
    ? {
        dialect: 'postgresql',
        schema: './src/db/schema.pg.ts',
        out: './drizzle/pg',
        dbCredentials: {
          url: DATABASE_URL!,
        },
      }
    : {
        dialect: 'sqlite',
        schema: './src/db/schema.sqlite.ts',
        out: './drizzle/sqlite',
        dbCredentials: {
          url: process.env.SQLITE_PATH || './data/app.db',
        },
      }
)
