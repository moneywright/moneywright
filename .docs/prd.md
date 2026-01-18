# Moneywright — Product Requirements Document (v2.1)

## What is this?

An open source, self-hostable personal finance tool that lets users upload financial statements, stores everything locally, and uses LLMs to analyze spending, answer questions, and provide financial guidance.

**Tagline idea:** "Your money, your data, your server."

---

## Who is this for?

Privacy-conscious individuals who:
- Want financial insights without handing data to fintech apps
- Are comfortable self-hosting (or following a simple setup guide)
- Have financial documents scattered across banks, cards, brokerages

---

## Core User Journey (V1)

```
Install → (Optional: Login) → Select country → Create profiles → Upload statements per profile → View parsed transactions → Ask questions / get insights (individual or family)
```

---

## V1 Feature Scope

### 1. Setup & Auth
- Single bun executable, runs locally or on a server
- **Authentication is optional**, controlled via env var:
  - `AUTH_ENABLED=false` — no login, single-user mode (default for local)
  - `AUTH_ENABLED=true` — Google OAuth, multi-user (for shared server deployments)
- First-time: select country (India first, structure for others)

### 2. Profiles (Family Support)
- A user can create multiple **profiles** (e.g., "Me", "Spouse", "Parent")
- Each profile has its own:
  - Accounts (bank, credit card, investments)
  - Transactions
  - Uploaded documents
- **Views:**
  - Individual profile view — just that person's finances
  - Family view — aggregated across all profiles
- Use cases:
  - "How much did *we* spend on travel this year?" (family)
  - "What's my wife's credit card bill this month?" (individual)
- Profile is a lightweight concept — no separate auth, just a way to segment data

### 3. Statement Upload & Parsing
- Supported formats: PDF, Excel/CSV
- Parser strategy:
  - **Structured parsers** for known formats (start with HDFC bank & credit card)
  - **LLM fallback** for unknown formats — extract text via pdf-parse, send to LLM with instructions to return structured transaction data
- User selects which **profile** the statement belongs to during upload
- User can review/correct parsed transactions before saving

### 4. Data Storage
- **SQLite** by default (zero config, file-based)
- **PostgreSQL** supported if `DATABASE_URL` is provided (for server deployments or preference)
- Core entities:
  - **User** — auth info, country, preferences *(only relevant if auth enabled)*
  - **Profile** — name, relationship/label, belongs to user
  - **Account** — bank account, credit card, investment account (type, institution, nickname, profile_id)
  - **Transaction** — date, amount, description, category, account_id, raw_source
  - **Document** — uploaded file reference, parse status, linked account
  - **Asset/Investment** — for manually declared holdings, linked to profile

### 5. Analysis & Chat
- Dashboard with basics: monthly spend, category breakdown, trends
- **Scope toggle:** Individual profile or Family (aggregated)
- Chat interface to ask questions:
  - "How much did I spend on food in December?"
  - "What's our total EMI outflow as a family?"
  - "Compare my spending vs my spouse's this quarter"
- LLM has access to transaction context (within token limits, smart retrieval)

### 6. Manual Declarations
- Users can manually add (per profile):
  - Investment holdings (MFs, stocks, FDs, PPF, etc.)
  - Recurring expenses/income not in statements
- Family net worth = sum across profiles

### 7. LLM Configuration
- Settings page to configure:
  - Provider: OpenAI / Anthropic / Ollama
  - API key (stored locally, encrypted)
  - Model selection

---

## What V1 is NOT

- Auto-sync with banks (no screen scraping or aggregator APIs)
- Gmail integration (future)
- Tax filing or ITR preparation
- Mobile app
- Separate logins per family member (profiles are managed by one user)

---

## Parser Strategy (Detail)

| Scenario | Approach |
|----------|----------|
| Known format (HDFC) | Structured parser, reliable extraction |
| Unknown PDF | pdf-parse → raw text → LLM prompt: "Extract transactions as JSON" |
| Excel/CSV | Column mapping UI or LLM-assisted header detection |

User always reviews before committing to DB. Flag low-confidence parses.

---

## Configuration (Env Vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | If provided, use PostgreSQL; otherwise SQLite |
| `AUTH_ENABLED` | `false` | Enable Google OAuth |
| `GOOGLE_CLIENT_ID` | — | Required if auth enabled |
| `GOOGLE_CLIENT_SECRET` | — | Required if auth enabled |
| `LLM_PROVIDER` | `openai` | Default LLM provider |
| `LLM_API_KEY` | — | API key (can also be set in UI) |
| `PORT` | `3000` | Server port |

---

## Future (Post-V1)

- **Gmail integration** — OAuth into Gmail, auto-detect and fetch statement emails, parse attachments
- **More structured parsers** — ICICI, SBI, Axis, Kotak, etc.
- **Tax insights** — "How much 80C have I used?", capital gains summary
- **Investment tracking** — Fetch NAVs, show portfolio performance
- **Recurring transaction detection** — Subscriptions, EMIs
- **Budgets and goals** — per profile or family-level
- **Export** — CSV, JSON for portability
- **Profile-level permissions** — if auth enabled, invite family members with their own login

---

## Open Questions / Decisions to Make

1. **Categories** — Predefined list or LLM-generated? (Suggest: predefined + "other" + user can add)
2. **Currency handling** — For multi-country, how to handle forex/conversion?
3. **Statement date ranges** — How to handle overlapping uploads / deduplication?
4. **Embedding/RAG** — For large transaction history, do we embed and vector search, or just smart SQL + summarization?
5. **Profile granularity** — Should profiles have their own country setting, or inherit from user/instance?

---

## Success Criteria (V1)

- User can go from zero to "seeing their last 3 months of spending by category" in under 10 minutes
- Works fully offline after initial setup (if using Ollama)
- Statement parsing works reliably for HDFC, reasonably for others via LLM fallback
- Family with 2-3 members can see combined and individual views seamlessly

---

Anything else to add or tweak? Or ready to save this as a doc?