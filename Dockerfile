# Moneywright - Docker Image
# AI-powered personal finance helper
# API serves both backend and SPA frontend on port 17777

# =============================================================================
# Base stage
# =============================================================================
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# =============================================================================
# Install dependencies for API (using Node.js for native module compilation)
# =============================================================================
FROM node:20-slim AS install-api

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install bun for package management
RUN npm install -g bun

WORKDIR /temp/dev
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
RUN bun install

# =============================================================================
# Install dependencies for Web
# =============================================================================
FROM base AS install-web
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
COPY apps/web/package.json /temp/dev/apps/web/
# Disable husky and skip scripts (no native modules needed for web)
ENV HUSKY=0
RUN cd /temp/dev && bun install --ignore-scripts

# =============================================================================
# Build Web (SPA)
# =============================================================================
FROM base AS build-web
COPY --from=install-web /temp/dev/node_modules node_modules
COPY --from=install-web /temp/dev/apps/web/node_modules apps/web/node_modules
COPY . .

WORKDIR /usr/src/app/apps/web
ENV HUSKY=0
RUN bun run build

# =============================================================================
# Build API
# =============================================================================
FROM node:20-slim AS build-api

# Install bun for building
RUN npm install -g bun

WORKDIR /usr/src/app
COPY --from=install-api /temp/dev/node_modules node_modules
COPY --from=install-api /temp/dev/apps/api/node_modules apps/api/node_modules
COPY . .

WORKDIR /usr/src/app/apps/api
RUN bun run build

# =============================================================================
# Production release
# =============================================================================
FROM base AS release

# Install runtime dependencies (wget for healthcheck)
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Copy API build
COPY --from=build-api /usr/src/app/apps/api/dist ./dist
COPY --from=build-api /usr/src/app/apps/api/package.json ./

# Copy Postgres migrations for auto-migration on startup
COPY --from=build-api /usr/src/app/apps/api/drizzle/pg ./drizzle/pg

# Copy Web build (SPA static files) to public directory
COPY --from=build-web /usr/src/app/apps/web/dist ./public

# Copy Docker configuration files
COPY entrypoint.sh /entrypoint.sh

# Make entrypoint executable
RUN chmod +x /entrypoint.sh

# Create data directory (owned by bun user)
RUN mkdir -p /usr/src/app/data && chown bun:bun /usr/src/app/data

# Expose single port
EXPOSE 17777/tcp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:17777/health || exit 1

# Environment defaults
ENV PORT=17777
ENV DATA_DIR=/usr/src/app/data

# Labels
LABEL org.opencontainers.image.title="Moneywright"
LABEL org.opencontainers.image.description="AI-powered personal finance helper - track expenses, investments, and get financial advice"

USER bun
ENTRYPOINT ["/entrypoint.sh"]
CMD ["bun", "run", "dist/index.js"]
