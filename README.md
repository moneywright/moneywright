# Moneywright

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

A privacy-focused, self-hostable, AI-powered personal finance manager. Upload your bank statements, credit card statements, and investment data to get intelligent expense analysis, investment insights, and personalized financial advice - all without sharing your data with third parties.

## Features

- **Privacy First**: Your financial data stays on your machine (SQLite by default) or your own database
- **AI-Powered Analysis**: Get intelligent insights into your spending patterns and investment performance
- **Statement Parsing**: Automatic extraction from bank statements, credit card statements, and investment PDFs
- **Smart Categorization**: AI-powered transaction categorization
- **Investment Tracking**: Track and analyze your investment portfolio
- **AI Chat**: Ask questions about your finances in natural language
- **Multi-Profile**: Support for family finance management
- **Self-Hostable**: Full control over your financial data
- **Cross-Platform**: CLI binary, Docker, or native desktop app (macOS, Windows, Linux)

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.1+

### Installation

```bash
# Clone the repository
git clone https://github.com/moneywright/moneywright.git
cd moneywright

# Install dependencies
bun install

# Start development server
bun run dev
```

Open [http://localhost:17777](http://localhost:17777) in your browser.

### First-Time Setup

1. Visit the app URL
2. Configure your LLM provider (OpenAI, Anthropic, Google AI, or local Ollama)
3. Complete the onboarding flow
4. Upload your first statement

## Installation Options

### Development

```bash
bun install
bun run dev
```

### Docker

```bash
docker-compose up -d
```

### Standalone Binary

Download from [Releases](https://github.com/moneywright/moneywright/releases) or build yourself:

```bash
bun run build:binary
./dist/moneywright
```

### Desktop App

Native system tray app with auto-updates:

```bash
bun run build:desktop:macos    # macOS
bun run build:desktop:windows  # Windows
bun run build:desktop:linux    # Linux
```

## Environment Variables

The app auto-generates required secrets on first run. Optional configuration:

```bash
# Database (default: SQLite)
DATABASE_URL=postgres://user:password@localhost:5432/dbname

# LLM Providers (at least one required for AI features)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Local LLM (Ollama)
OLLAMA_BASE_URL=http://localhost:11434/api

# Optional Services
TAVILY_API_KEY=...     # Web search in chat
E2B_API_KEY=...        # Sandboxed code execution

# OAuth (for multi-user mode)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Commands

```bash
# Development
bun run dev              # Start API + Web dev servers
bun run dev:api          # API only (localhost:17777)
bun run dev:web          # Web only (localhost:3000)

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:studio        # Open Drizzle Studio

# Build
bun run build            # Production build
bun run build:binary     # Build CLI binary
bun run build:desktop    # Build desktop app

# Quality
bun run lint             # Run linters
bun run format           # Format code
```

## Project Structure

```
moneywright/
├── apps/
│   ├── api/              # Hono backend (Bun runtime)
│   ├── web/              # React frontend (Vite + TanStack)
│   ├── docs/             # Documentation (Fumadocs)
│   └── desktop/          # Desktop app (Tauri + Rust)
├── scripts/              # Build scripts
└── .docs/                # Internal documentation
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Hono, Bun, Drizzle ORM |
| Frontend | React 19, TanStack Router, TanStack Query, Tailwind CSS |
| AI | Vercel AI SDK (OpenAI, Anthropic, Google AI, Ollama) |
| Database | SQLite (default) or PostgreSQL |
| Desktop | Tauri 2, Rust |
| Docs | Fumadocs, Cloudflare Workers |

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## Security

For security issues, please see our [Security Policy](SECURITY.md).

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Copyright (c) 2025 Priyansh Rastogi
