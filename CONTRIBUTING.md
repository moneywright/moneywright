# Contributing to Moneywright

Thank you for your interest in contributing to Moneywright! This document provides guidelines and information for contributors.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (OS, browser, Node.js version)
- Relevant logs or screenshots

### Suggesting Features

Feature requests are welcome. Please:

- Check if the feature has already been requested
- Provide a clear description of the feature
- Explain why this feature would be useful
- Consider how it fits with the project's goals

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `bun install`
3. **Make your changes** following the code style guidelines below
4. **Test your changes** locally
5. **Run linting**: `bun run lint`
6. **Run formatting**: `bun run format`
7. **Commit your changes** with a clear commit message
8. **Push to your fork** and submit a pull request

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (v1.0 or later)
- [Node.js](https://nodejs.org/) (v20 or later)
- [Rust](https://rustup.rs/) (for desktop app development)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/moneywright/moneywright.git
cd moneywright

# Install dependencies
bun install

# Set up environment (API will auto-generate .env if missing)
cd apps/api
cp .env.example .env.local  # Optional: customize settings

# Start development servers
cd ../..
bun run dev
```

### Project Structure

```
moneywright/
├── apps/
│   ├── api/      # Backend (Hono + Bun)
│   ├── web/      # Frontend (React + Vite)
│   ├── docs/     # Documentation (Fumadocs)
│   └── desktop/  # Desktop app (Tauri)
└── scripts/      # Build scripts
```

## Code Style Guidelines

### General

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Keep functions small and focused
- Write self-documenting code; add comments only when necessary
- No unused imports or variables

### TypeScript

- Use strict mode
- Prefer `interface` over `type` for object shapes
- Use explicit return types for exported functions
- Avoid `any` - use `unknown` if type is truly unknown

### React (Web Package)

- Use functional components with hooks
- Keep components small and focused
- Co-locate related files (component, styles, tests)
- Use TanStack Query for server state
- Use Tailwind CSS for styling

### API (Backend)

- Keep route handlers thin - delegate to services
- Use Zod for input validation
- Return proper HTTP status codes
- Log errors with context

### Commit Messages

Use conventional commit format:

```
type: short description

Optional longer description

Optional footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat: add transaction export feature`
- `fix: correct date parsing for UK statements`
- `docs: update API documentation`

## Testing

Currently, the project does not have a formal test suite. If you're adding tests:

- Place test files next to the code they test
- Use descriptive test names
- Test behavior, not implementation

## Database Changes

When modifying the database schema:

1. Update both `schema.sqlite.ts` and `schema.pg.ts`
2. Generate migration: `bun run db:generate`
3. Test migration: `bun run db:migrate`
4. Include migration files in your PR

## Documentation

- Update documentation for user-facing changes
- Use clear, concise language
- Include code examples where helpful

## Questions?

- Open a [GitHub Discussion](https://github.com/moneywright/moneywright/discussions) for questions
- Check existing issues and discussions first

## License

By contributing to Moneywright, you agree that your contributions will be licensed under the [GNU Affero General Public License v3.0](LICENSE).
