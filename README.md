<div align="center">
  <img src="apps/web/public/logo.png" alt="Moneywright Logo" width="120" height="120">

  # Moneywright

  **Stop wondering where your money goes**

  Drop all your bank and card statements. See exactly where your money went,
  find subscriptions you forgot about, and chat with AI about your finances.
  Free forever. Open source. Self-hosted.

  [![GitHub Release](https://img.shields.io/github/v/release/moneywright/moneywright?style=flat-square&color=10b981)](https://github.com/moneywright/moneywright/releases)
  [![Docker Build](https://img.shields.io/github/actions/workflow/status/moneywright/moneywright/docker.yml?style=flat-square&label=docker)](https://github.com/moneywright/moneywright/actions/workflows/docker.yml)
  [![License](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)
  [![GitHub Stars](https://img.shields.io/github/stars/moneywright/moneywright?style=flat-square)](https://github.com/moneywright/moneywright/stargazers)

  [Website](https://moneywright.com) · [Documentation](https://moneywright.com/docs) · [Download](https://github.com/moneywright/moneywright/releases)

</div>

---

<div align="center">

**₹4,299/mo** hidden subscriptions found on average · **500+** banks supported · **30 sec** to import your first statement · **$0** forever

</div>

---

## Why Moneywright?

Most finance apps want your bank login credentials. They sync your data to their servers. They monetize your information. You're the product, not the customer.

**Moneywright is different:**
- 📄 **Upload statements directly** — No bank logins, no account linking, no Plaid
- 🔒 **Your data stays local** — SQLite database on your machine, never uploaded anywhere
- 🤖 **Bring your own AI** — Use OpenAI, Anthropic, Google, or run fully local with Ollama
- 💸 **Free forever** — Open source, no subscriptions, no premium tiers

## Features

- **Upload Any Statement** — PDF, CSV, Excel from any bank or credit card worldwide
- **AI-Powered Parsing** — Extracts and categorizes every transaction automatically
- **Find Hidden Subscriptions** — Discovers recurring charges you forgot about
- **Investment Tracking** — Stocks, mutual funds, EPF, PPF, NPS in one dashboard
- **Chat with Penny** — Ask "How much did I spend on food last month?" in plain English
- **Beautiful Insights** — Charts and analytics that actually make sense
- **Multi-Profile** — Track finances for your whole family separately
- **Cross-Platform** — Desktop app, CLI binary, or Docker

## Quick Start

### Option A: Desktop App (Recommended)

Download the native app for your platform:

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Download .dmg](https://github.com/moneywright/moneywright/releases/latest) |
| macOS (Intel) | [Download .dmg](https://github.com/moneywright/moneywright/releases/latest) |
| Windows | [Download .exe](https://github.com/moneywright/moneywright/releases/latest) |
| Linux | [Download .deb](https://github.com/moneywright/moneywright/releases/latest) |

Runs in your system tray. Includes auto-updates.

---

### Option B: CLI Binary

**macOS / Linux:**
```bash
curl -fsSL https://moneywright.com/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm moneywright.com/install.ps1 | iex
```

Installs to `~/.moneywright` (macOS), `~/.local/share/moneywright` (Linux), or `%LOCALAPPDATA%\Moneywright` (Windows).

---

### Option C: Docker

```bash
mkdir moneywright && cd moneywright

cat > docker-compose.yml << 'EOF'
services:
  moneywright:
    image: ghcr.io/moneywright/moneywright:latest
    ports:
      - "17777:17777"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - moneywright-data:/usr/src/app/data

volumes:
  moneywright-data:
EOF

cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF

docker compose up -d
```

Open http://localhost:17777

---

### Get Started in 30 Seconds

1. Download and run Moneywright
2. Add your LLM API key (or connect to local Ollama)
3. Drop a bank statement PDF
4. See your spending breakdown instantly

No account creation. No email. No signup.

## Supported Banks & Brokers

Works with **any bank that provides PDF or CSV statements**. AI extracts transactions automatically.

Tested with: HDFC, ICICI, SBI, Axis, Kotak, HSBC, Amex, Citi, Chase, Bank of America, Zerodha, Groww, Vested, Kite, and 500+ more.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | One of these | OpenAI API key |
| `ANTHROPIC_API_KEY` | required for | Anthropic API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | AI features | Google AI API key |
| `OLLAMA_BASE_URL` | (or Ollama) | Local LLM (default: `http://localhost:11434/api`) |
| `JWT_SECRET` | Auto | Auto-generated on first run |
| `ENCRYPTION_KEY` | Auto | Auto-generated on first run |
| `DATABASE_URL` | No | PostgreSQL URL (default: SQLite) |
| `PORT` | No | Server port (default: `17777`) |

LLM keys can be configured in the app's Settings page — no `.env` file needed.

## Development

```bash
# Prerequisites: Bun v1.1+
bun install
bun run dev
```

- API: http://localhost:17777
- Web: http://localhost:3000

### Commands

```bash
bun run dev              # Start dev servers
bun run build            # Production build
bun run build:binary     # Build CLI binary
bun run build:desktop    # Build desktop app (requires Rust)
bun run db:migrate       # Run migrations
bun run db:studio        # Open Drizzle Studio
```

### Project Structure

```
moneywright/
├── apps/
│   ├── api/          # Hono backend (Bun)
│   ├── web/          # React frontend (Vite + TanStack)
│   ├── docs/         # Documentation (Fumadocs)
│   └── desktop/      # Desktop app (Tauri + Rust)
├── scripts/          # Build scripts
└── Dockerfile
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| Backend | [Hono](https://hono.dev) |
| Frontend | React 19, TanStack Router, Tailwind, shadcn/ui |
| AI | [Vercel AI SDK](https://sdk.vercel.ai) |
| Database | SQLite / PostgreSQL via [Drizzle](https://orm.drizzle.team) |
| Desktop | [Tauri 2](https://v2.tauri.app) + Rust |

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[AGPL-3.0](LICENSE) — Priyansh Rastogi © 2025

## Links

- [Website](https://moneywright.com)
- [Documentation](https://moneywright.com/docs)
- [Issues](https://github.com/moneywright/moneywright/issues)
- [Discussions](https://github.com/moneywright/moneywright/discussions)
