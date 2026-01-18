# Moneywright

An open-source, self-hostable, AI-powered personal finance helper. Upload your bank statements, credit card statements, and investment data to get intelligent expense analysis, investment insights, and personalized financial advice.

## Features

- **AI-Powered Analysis**: Get intelligent insights into your spending patterns and investment performance
- **Statement Upload**: Import bank statements, credit card statements, and investment data
- **Expense Tracking**: Automatic categorization and analysis of your expenses
- **Investment Analysis**: Track and analyze your investment portfolio
- **Financial Advice**: Personalized recommendations based on your financial data
- **Self-Hostable**: Full control over your financial data
- **Authentication**: Google OAuth with secure JWT session management
- **Database**: PostgreSQL or SQLite with Drizzle ORM
- **Frontend**: React 19 with TailwindCSS and shadcn/ui
- **API**: Hono with TypeScript
- **Documentation**: Fumadocs with MDX
- **Deployment**: Docker, binary, or cloud platforms

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- Google OAuth credentials (or configure via `/setup` UI)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

Open [http://localhost:7777](http://localhost:7777) in your browser.

### First-Time Setup

1. Visit the app URL
2. You'll be redirected to `/setup` if not configured
3. Enter your Google OAuth credentials
4. Click "Save Configuration"

## Environment Variables

Create a `.env` file in the root directory:

```bash
# Required for Docker/Cloud (auto-generated for binary)
JWT_SECRET=your-secret-key-min-32-chars
ENCRYPTION_KEY=64-hex-character-encryption-key

# Optional - Google OAuth (can configure via /setup UI instead)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional
APP_URL=http://localhost:7777   # Public URL
DATABASE_URL=postgres://...     # Use PostgreSQL (default: SQLite)
PORT=7777
```

## Commands

```bash
# Development
bun install              # Install dependencies
bun run dev              # Start API + Vite dev server
bun run dev:api          # API only (localhost:7777)
bun run dev:web          # Vite dev server (localhost:3000)

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:push          # Push schema changes
bun run db:studio        # Drizzle Studio

# Build
bun run build            # Production build (API + Web)
bun run build:binary     # Build single binary for current platform

# Quality
bun run lint             # Run ESLint
bun run format           # Run Prettier
```

## Project Structure

```
moneywright/
├── apps/
│   ├── api/              # Hono backend
│   │   ├── src/
│   │   │   ├── db/       # Database schemas & connection
│   │   │   ├── lib/      # Utilities (JWT, encryption, etc.)
│   │   │   ├── middleware/
│   │   │   ├── routes/   # API routes
│   │   │   └── services/ # Business logic
│   │   └── drizzle/      # Migrations
│   │
│   ├── web/              # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/   # shadcn components
│   │   │   │   └── domain/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── routes/   # TanStack Router
│   │   └── package.json
│   │
│   └── docs/             # Documentation (Fumadocs)
│       ├── content/docs/ # MDX files
│       └── package.json
│
├── scripts/
│   └── build-binary.sh   # Binary build script
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Database

### SQLite (Default)

No configuration needed. Data is stored in `data/app.db`.

### PostgreSQL

Set the `DATABASE_URL` environment variable:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/dbname
```

## Deployment

### Docker

```bash
# Build and run
docker-compose up -d

# Or build manually
docker build -t moneywright .
docker run -p 7777:7777 moneywright
```

### Binary

```bash
# Build for current platform
bun run build:binary

# Run the binary
./dist/moneywright
```

The binary auto-generates a `.env` file with secure secrets on first run.

### Cloud Platforms

Deploy to Railway, Render, Fly.io, or any platform that supports Docker.

## API Routes

```
Setup:     GET|POST /api/setup/config|status
Auth:      GET|POST /api/auth/google|refresh|logout|me|sessions
Health:    GET /health
```

## Authentication Flow

1. User clicks "Sign in with Google"
2. Redirected to Google OAuth consent
3. Callback receives auth code
4. Server exchanges code for tokens
5. Server creates/updates user record
6. JWT access token (15min) + refresh token (7 days) set as HttpOnly cookies
7. Client uses access token for API requests
8. Automatic token refresh on 401 responses

## Customization

### Adding New Routes

1. Create route file in `apps/api/src/routes/`
2. Export Hono app instance
3. Mount in `apps/api/src/index.ts`

### Adding Database Tables

1. Update schemas in `apps/api/src/db/schema.pg.ts` and `schema.sqlite.ts`
2. Run `bun run db:generate` to create migrations
3. Run `bun run db:migrate` to apply

### Adding Frontend Pages

1. Create route file in `apps/web/src/routes/`
2. TanStack Router auto-generates types

### Adding UI Components

```bash
cd apps/web
bunx shadcn@latest add [component-name]
```

## License

MIT
