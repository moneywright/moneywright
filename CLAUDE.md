# Moneywright

A privacy-focused personal finance manager that runs locally. Users can upload bank statements, track expenses, manage investments, and get AI-powered insights without sharing their data with third parties.

## Project Structure

```
moneywright/
├── apps/
│   ├── api/          # Hono backend server (Bun runtime)
│   ├── web/          # React frontend (Vite + TanStack Router)
│   ├── docs/         # Documentation site (Fumadocs + TanStack Start)
│   └── desktop/      # System tray app (Tauri + Rust)
├── scripts/          # Build and deployment scripts
└── .docs/            # Internal documentation and plans
```

## Tech Stack

| Package | Technologies |
|---------|-------------|
| **api** | Hono, Bun, Drizzle ORM, SQLite/PostgreSQL, Vercel AI SDK |
| **web** | React 19, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui |
| **docs** | Fumadocs, TanStack Start, Tailwind CSS, Cloudflare Workers |
| **desktop** | Tauri 2, Rust, sidecar binary pattern |

## Quick Start

```bash
# Install dependencies
bun install

# Start development (api + web in parallel)
bun run dev

# Database commands
bun run db:generate    # Generate migrations from schema changes
bun run db:migrate     # Apply migrations
bun run db:studio      # Open Drizzle Studio GUI
```

## Package-Specific Development

```bash
# API only
bun run dev:api        # Port 17777

# Web only
bun run dev:web        # Port 3000

# Docs
cd apps/docs && bun run dev    # Port 3002

# Desktop (requires Rust)
cd apps/desktop && bun run tauri dev
```

## Build Commands

```bash
# Production builds
bun run build          # Build api + web

# Standalone binary (CLI installation)
bun run build:binary                    # Current platform
bun run build:binary:macos              # macOS ARM64
bun run build:binary:macos-intel        # macOS Intel
bun run build:binary:linux              # Linux x64
bun run build:binary:windows            # Windows x64

# Desktop app with native installer
bun run build:desktop                   # Current platform
bun run build:desktop:macos             # macOS DMG
bun run build:desktop:windows           # Windows NSIS
bun run build:desktop:linux             # Linux DEB
```

---

# Best Practices

## General Principles

1. **Keep it simple** - Avoid over-engineering. Only add complexity when genuinely needed.
2. **Modularity first** - Components, services, and utilities should be self-contained and reusable.
3. **Consistent patterns** - Follow existing patterns in the codebase rather than introducing new ones.
4. **Type safety** - Use TypeScript strictly. Avoid `any` types.
5. **No dead code** - Remove unused imports, variables, and functions immediately.

## API Package (`apps/api`)

### File Organization
- **Routes** (`src/routes/`) - Thin handlers that delegate to services. Keep business logic out.
- **Services** (`src/services/`) - Business logic and database queries. One service per domain.
- **Lib** (`src/lib/`) - Pure utility functions with no side effects.
- **LLM** (`src/llm/`) - AI/LLM integration code isolated here.

### Patterns to Follow
```typescript
// Routes: Thin handlers, delegate to services
routes.get('/', async (c) => {
  const userId = c.get('userId')
  const data = await someService.getData(userId)
  return c.json(data)
})

// Services: Business logic with clear interfaces
export async function getData(userId: string): Promise<Data[]> {
  return db.select().from(tables.data).where(eq(tables.data.userId, userId))
}

// Utilities: Pure functions, no dependencies on app state
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}
```

### Database Guidelines
- Use Drizzle ORM query builder, not raw SQL
- Schema changes require migration: `bun run db:generate` then `bun run db:migrate`
- Both SQLite and PostgreSQL are supported - test changes work on both
- Use transactions for multi-step operations
- Index frequently queried columns

### Error Handling
```typescript
// Return proper HTTP status codes
return c.json({ error: 'not_found', message: 'Resource not found' }, 404)

// Log errors with context
logger.error('Failed to process statement', { statementId, error: e.message })
```

## Web Package (`apps/web`)

### Component Organization
```
src/
├── components/
│   ├── ui/           # Reusable primitives (Button, Card, Input)
│   ├── domain/       # App-level components (AppSidebar, ProfileSelector)
│   └── {feature}/    # Feature-specific (transactions/, chat/, statements/)
├── hooks/            # Custom React hooks (one per domain)
├── routes/           # Page components (file-based routing)
└── lib/              # Utilities and API client
```

### Component Guidelines

1. **Single responsibility** - Each component does one thing well
2. **Props over state** - Prefer controlled components
3. **Composition over configuration** - Build complex UIs from simple pieces
4. **Co-locate related code** - Keep styles, types, and tests near components

```typescript
// Good: Focused component with clear props
interface TransactionRowProps {
  transaction: Transaction
  onEdit: (id: string) => void
}

export function TransactionRow({ transaction, onEdit }: TransactionRowProps) {
  // Component logic here
}

// Bad: God component with too many responsibilities
export function TransactionPage() {
  // Don't: fetch data, manage modals, handle forms all in one component
}
```

### State Management

1. **Server state** - Use TanStack Query for API data
2. **URL state** - Use search params for filters, pagination, modals
3. **Local UI state** - Use useState for component-specific state
4. **Global state** - Use Context sparingly (auth only)

```typescript
// Query keys factory pattern
export const transactionKeys = {
  all: ['transactions'] as const,
  list: (filters: Filters) => [...transactionKeys.all, 'list', filters] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
}

// Mutations with proper cache invalidation
const mutation = useMutation({
  mutationFn: updateTransaction,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: transactionKeys.all })
  },
})
```

### Styling Guidelines

1. Use Tailwind CSS utility classes
2. Use `cn()` helper for conditional classes
3. Keep consistent spacing (use Tailwind's spacing scale)
4. Respect dark mode (use CSS variables, not hardcoded colors)
5. Mobile-first responsive design

```typescript
// Good: Using cn() for conditional styling
<div className={cn(
  "rounded-lg border p-4",
  isActive && "border-primary bg-primary/5",
  className
)}>

// Bad: Inline style objects
<div style={{ borderRadius: '8px', padding: '16px' }}>
```

### Routing

- File-based routing via TanStack Router
- Use loaders for data fetching when possible
- Validate search params with Zod schemas
- Handle loading and error states

## Docs Package (`apps/docs`)

### Content Guidelines
- Write documentation in MDX files under `content/docs/`
- Use clear headings and code examples
- Keep pages focused on single topics
- Navigation auto-generates from file structure

### Adding Documentation
1. Create `.mdx` file in `content/docs/`
2. Add YAML frontmatter (title, description)
3. Write content with markdown + optional React components

## Desktop Package (`apps/desktop`)

### Architecture
- Tauri app with no windows (menu bar/system tray only)
- Sidecar binary pattern - bundles the API server
- Rust code in `src-tauri/src/`

### Key Files
- `lib.rs` - App initialization and lifecycle
- `server.rs` - Sidecar process management
- `tray.rs` - System tray menu
- `updater.rs` - Auto-update logic

### Guidelines
- Keep Rust code minimal - complex logic belongs in the sidecar
- Test on all platforms before release
- Update icons in `src-tauri/icons/` when branding changes

---

# Code Quality

## Pre-commit Hooks

Husky runs lint-staged on commit:
- API/Web: ESLint + Prettier
- Docs: Biome

## Linting & Formatting

```bash
# Check all packages
bun run lint

# Format all packages
bun run format

# Check formatting without changes
bun run format:check
```

## TypeScript

- Strict mode enabled in all packages
- No implicit any
- Use explicit return types for exported functions
- Prefer `interface` over `type` for object shapes

---

# Environment Variables

## API Package

Required (auto-generated if missing):
```env
JWT_SECRET=<32+ characters>
ENCRYPTION_KEY=<64 hex characters>
```

Optional:
```env
# Database (SQLite default, set for PostgreSQL)
DATABASE_URL=postgres://user:pass@host:port/db

# LLM Providers (at least one required for AI features)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# OAuth (for multi-user mode)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional services
TAVILY_API_KEY=        # Web search in chat
E2B_API_KEY=           # Sandboxed code execution
OLLAMA_BASE_URL=       # Local LLM (default: http://localhost:11434/api)
```

## Ports

| Service | Development | Production |
|---------|-------------|------------|
| API | 17777 | 17777 |
| Web | 3000 | (served by API) |
| Docs | 3002 | (Cloudflare Workers) |
| Desktop | 17777 | 17777 |

---

# Common Tasks

## Adding a New API Endpoint

1. Create/update route in `apps/api/src/routes/`
2. Add service function in `apps/api/src/services/`
3. Update API client in `apps/web/src/lib/api.ts`
4. Create React Query hook in `apps/web/src/hooks/`

## Adding a Database Table

1. Update schema in `apps/api/src/db/schema.sqlite.ts` AND `schema.pg.ts`
2. Generate migration: `bun run db:generate`
3. Apply migration: `bun run db:migrate`

## Adding a UI Component

1. Check if shadcn/ui has it: https://ui.shadcn.com
2. If yes, add to `apps/web/src/components/ui/`
3. If no, create in appropriate feature folder
4. Export from barrel file if reusable

## Debugging

```bash
# API logs
ENABLE_LOGGING=true bun run dev:api

# Database queries
bun run db:studio

# React Query devtools
# Automatically available in development
```

---

# Security Considerations

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Use Zod schemas
3. **Sanitize database queries** - Use Drizzle ORM (parameterized queries)
4. **Encrypt sensitive data** - Use the encryption utilities for API keys, account numbers
5. **CORS restrictions** - Only allow known origins
6. **HttpOnly cookies** - For authentication tokens
7. **Content Security Policy** - Configured in security headers middleware

---

# Git Workflow

1. Create feature branch from `main`
2. Make changes with clear, atomic commits
3. Run `bun run lint` and `bun run format` before committing
4. Create PR with description of changes
5. Squash merge to main

Commit message format:
```
feat: add transaction export feature
fix: correct date parsing for UK statements
refactor: simplify account service queries
docs: update API documentation
```
