# Engineering Design Document: Statements, Accounts & Transactions

## Overview

This document outlines the technical design for the core financial data system in Moneywright, covering:
- Account management (auto-created from statements)
- Statement upload and background parsing
- Transaction storage with LLM-powered categorization
- Cross-account payment linking
- Statement password handling

---

## Database Schema

### Accounts Table

Stores financial accounts (bank accounts, credit cards, investments, etc.) auto-created from uploaded statements.

```sql
accounts (
  id                TEXT PRIMARY KEY,        -- nanoid
  profile_id        TEXT NOT NULL,           -- FK to profiles
  user_id           TEXT NOT NULL,           -- FK to users (denormalized for queries)

  -- Account identification
  type              TEXT NOT NULL,           -- account type (country-specific, see below)
  institution       TEXT,                    -- bank/institution name (free text)
  account_number    TEXT,                    -- encrypted, full account number
  account_name      TEXT,                    -- user-friendly name, auto-generated or user-edited

  -- Statement password (for password-protected PDFs)
  statement_password TEXT,                   -- encrypted, used for future uploads

  -- Metadata
  currency          TEXT NOT NULL,           -- ISO currency code (INR, USD, etc.)
  is_active         BOOLEAN DEFAULT true,

  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
)
```

**Account Types by Country:**

| Country | Account Types |
|---------|---------------|
| India (IN) | `savings_account`, `current_account`, `credit_card`, `fixed_deposit`, `ppf`, `epf`, `nps`, `demat`, `other` |
| USA (US) | `checking_account`, `savings_account`, `credit_card`, `401k`, `ira`, `brokerage`, `cd`, `other` |

### Statements Table

Stores uploaded statement documents and their parsing status.

```sql
statements (
  id                TEXT PRIMARY KEY,        -- nanoid
  account_id        TEXT NOT NULL,           -- FK to accounts
  profile_id        TEXT NOT NULL,           -- FK to profiles (denormalized)
  user_id           TEXT NOT NULL,           -- FK to users (denormalized)

  -- File info (not stored permanently, just metadata)
  original_filename TEXT NOT NULL,
  file_type         TEXT NOT NULL,           -- 'pdf', 'csv', 'xlsx'
  file_size_bytes   INTEGER,

  -- Statement period
  period_start      DATE,                    -- extracted from statement
  period_end        DATE,                    -- extracted from statement

  -- Parsing status
  status            TEXT NOT NULL DEFAULT 'pending',
                                             -- 'pending', 'parsing', 'completed', 'failed'
  error_message     TEXT,                    -- error details if failed

  -- Statement summary (extracted during parsing)
  summary           JSONB,                   -- type-specific summary (see below)

  -- Stats
  transaction_count INTEGER DEFAULT 0,

  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
)
```

**Statement Summary JSON Structure:**

For Bank Statements:
```json
{
  "type": "bank_statement",
  "opening_balance": 50000.00,
  "closing_balance": 45000.00,
  "total_credits": 100000.00,
  "total_debits": 105000.00,
  "credit_count": 5,
  "debit_count": 25
}
```

For Credit Card Statements:
```json
{
  "type": "credit_card_statement",
  "credit_limit": 200000.00,
  "available_limit": 150000.00,
  "previous_balance": 30000.00,
  "payments_received": 30000.00,
  "new_charges": 50000.00,
  "total_due": 50000.00,
  "minimum_due": 2500.00,
  "due_date": "2024-02-15",
  "credit_count": 2,
  "debit_count": 15
}
```

### Transactions Table

Stores individual transactions extracted from statements.

```sql
transactions (
  id                TEXT PRIMARY KEY,        -- nanoid
  account_id        TEXT NOT NULL,           -- FK to accounts
  statement_id      TEXT NOT NULL,           -- FK to statements
  profile_id        TEXT NOT NULL,           -- FK to profiles (denormalized)
  user_id           TEXT NOT NULL,           -- FK to users (denormalized)

  -- Transaction data
  date              DATE NOT NULL,
  type              TEXT NOT NULL,           -- 'credit' or 'debit'
  amount            DECIMAL(15, 2) NOT NULL, -- always positive, type indicates direction
  currency          TEXT NOT NULL,           -- ISO currency code

  -- Description
  original_description TEXT NOT NULL,        -- raw description from statement
  summary           TEXT,                    -- LLM-generated summary

  -- Categorization
  category          TEXT NOT NULL,           -- category code (see below)
  category_confidence DECIMAL(3, 2),         -- 0.00 to 1.00, LLM confidence

  -- Deduplication
  hash              TEXT NOT NULL,           -- SHA256(date + amount + original_description)

  -- Cross-account linking
  linked_transaction_id TEXT,                -- FK to transactions (for payment linking)
  link_type         TEXT,                    -- 'payment', 'transfer', 'refund'

  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  UNIQUE(account_id, hash)                   -- prevent duplicates within same account
)
```

### Categories

Country-specific predefined categories stored in constants.

**India Categories:**
| Code | Label |
|------|-------|
| `food_dining` | Food & Dining |
| `groceries` | Groceries |
| `shopping` | Shopping |
| `utilities` | Utilities (Electricity, Water, Gas) |
| `mobile_internet` | Mobile & Internet |
| `emi` | EMI / Loan Payment |
| `rent` | Rent |
| `fuel` | Fuel |
| `entertainment` | Entertainment |
| `travel` | Travel |
| `healthcare` | Healthcare |
| `education` | Education |
| `insurance` | Insurance |
| `investment` | Investment |
| `transfer` | Transfer |
| `atm_withdrawal` | ATM Withdrawal |
| `salary` | Salary / Income |
| `refund` | Refund |
| `cashback` | Cashback / Rewards |
| `tax` | Tax Payment |
| `government` | Government Services |
| `charity` | Charity / Donations |
| `other` | Other |

**USA Categories:**
| Code | Label |
|------|-------|
| `food_dining` | Food & Dining |
| `groceries` | Groceries |
| `shopping` | Shopping |
| `utilities` | Utilities |
| `phone_internet` | Phone & Internet |
| `mortgage` | Mortgage |
| `rent` | Rent |
| `gas` | Gas / Fuel |
| `entertainment` | Entertainment |
| `travel` | Travel |
| `healthcare` | Healthcare |
| `education` | Education |
| `insurance` | Insurance |
| `investment` | Investment |
| `transfer` | Transfer |
| `atm_withdrawal` | ATM Withdrawal |
| `paycheck` | Paycheck / Income |
| `refund` | Refund |
| `cashback` | Cashback / Rewards |
| `tax` | Tax Payment |
| `subscription` | Subscriptions |
| `childcare` | Childcare |
| `pet` | Pet Expenses |
| `charity` | Charity / Donations |
| `other` | Other |

### Investments Table (Manual Entry)

For manually declared investment holdings.

```sql
investments (
  id                TEXT PRIMARY KEY,        -- nanoid
  profile_id        TEXT NOT NULL,           -- FK to profiles
  user_id           TEXT NOT NULL,           -- FK to users (denormalized)

  -- Investment details
  type              TEXT NOT NULL,           -- country-specific (see below)
  institution       TEXT,                    -- broker/AMC name
  name              TEXT NOT NULL,           -- scheme/stock name

  -- Holdings
  units             DECIMAL(15, 4),          -- number of units (for MF, stocks)
  purchase_value    DECIMAL(15, 2),          -- total invested amount
  current_value     DECIMAL(15, 2),          -- current market value (manual update)
  currency          TEXT NOT NULL,

  -- Additional info
  folio_number      TEXT,                    -- for mutual funds
  account_number    TEXT,                    -- encrypted, for demat/brokerage
  maturity_date     DATE,                    -- for FDs, bonds
  interest_rate     DECIMAL(5, 2),           -- for FDs, PPF, etc.

  notes             TEXT,

  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
)
```

**Investment Types by Country:**

| Country | Investment Types |
|---------|------------------|
| India (IN) | `mutual_fund`, `stocks`, `fixed_deposit`, `ppf`, `epf`, `nps`, `bonds`, `gold`, `real_estate`, `other` |
| USA (US) | `mutual_fund`, `etf`, `stocks`, `401k`, `ira`, `cd`, `bonds`, `real_estate`, `other` |

---

## API Endpoints

### Accounts

```
GET    /api/accounts                    -- List accounts for current user (filter by profile_id)
GET    /api/accounts/:id                -- Get account details
PATCH  /api/accounts/:id                -- Update account (name, statement_password)
DELETE /api/accounts/:id                -- Delete account (cascades to statements, transactions)
```

### Statements

```
POST   /api/statements/upload           -- Upload statement (multipart form)
GET    /api/statements                  -- List statements (filter by account_id, profile_id)
GET    /api/statements/:id              -- Get statement details with summary
DELETE /api/statements/:id              -- Delete statement (cascades to transactions)
GET    /api/statements/:id/status       -- Poll parsing status
```

### Transactions

```
GET    /api/transactions                -- List transactions (filter, paginate, search)
GET    /api/transactions/:id            -- Get transaction details
PATCH  /api/transactions/:id            -- Update category, link_transaction
POST   /api/transactions/link           -- Link two transactions (payment/transfer)
DELETE /api/transactions/:id/link       -- Remove transaction link
```

### Investments

```
GET    /api/investments                 -- List investments (filter by profile_id)
POST   /api/investments                 -- Create investment
GET    /api/investments/:id             -- Get investment details
PATCH  /api/investments/:id             -- Update investment
DELETE /api/investments/:id             -- Delete investment
```

### Categories

```
GET    /api/categories                  -- Get categories for user's country
```

---

## Statement Upload & Parsing Flow

### 1. Upload Flow

```
Client                          Server                          Background Worker
  |                               |                                    |
  |-- POST /statements/upload --->|                                    |
  |   (file, profile_id,          |                                    |
  |    account_id?, password?)    |                                    |
  |                               |                                    |
  |                               |-- Validate file type/size          |
  |                               |-- If password-protected PDF:       |
  |                               |   - Try provided password          |
  |                               |   - Try saved account password     |
  |                               |   - Return 422 if neither work     |
  |                               |                                    |
  |                               |-- Extract text from PDF/CSV        |
  |                               |-- Create statement record          |
  |                               |   (status: 'pending')              |
  |                               |-- Queue parsing job                |
  |                               |                                    |
  |<-- 202 Accepted --------------|                                    |
  |   { statement_id, status }    |                                    |
  |                               |                                    |
  |                               |                                    |
  |-- GET /statements/:id/status ->|                                   |
  |                               |                                    |
  |<-- { status: 'parsing' } -----|                                    |
  |                               |                                    |
  |                               |                 |-- Pick up job ---|
  |                               |                 |                  |
  |                               |                 |-- Parse page 1   |
  |                               |                 |   via LLM        |
  |                               |                 |-- Parse page 2   |
  |                               |                 |   via LLM        |
  |                               |                 |-- ...            |
  |                               |                 |                  |
  |                               |                 |-- Deduplicate    |
  |                               |                 |-- Save txns      |
  |                               |                 |-- Detect links   |
  |                               |                 |-- Update status  |
  |                               |                 |   to 'completed' |
  |                               |                                    |
  |-- GET /statements/:id/status ->|                                   |
  |                               |                                    |
  |<-- { status: 'completed',     |                                    |
  |      transaction_count: 25 }  |                                    |
```

### 2. LLM Parsing Strategy

**Page-by-Page Processing:**

1. Extract text from PDF using `pdf-parse` library
2. Split content by pages
3. For each page, send to LLM with structured prompt
4. Merge and deduplicate results

**LLM Prompt Template:**

```
You are a financial document parser. Extract transactions from the following bank/credit card statement page.

Statement Text:
---
{page_text}
---

Instructions:
1. Extract ALL transactions visible on this page
2. For each transaction, provide:
   - date (YYYY-MM-DD format)
   - type ('credit' or 'debit')
   - amount (positive number)
   - original_description (exact text from statement)
   - summary (brief, clear description of what this transaction is)
   - category (one of: {category_list})
   - category_confidence (0.0 to 1.0)

3. Also extract statement summary if visible on this page:
   - For bank statements: opening_balance, closing_balance, period_start, period_end
   - For credit cards: credit_limit, total_due, minimum_due, due_date, etc.

4. If this page contains no transactions (e.g., terms & conditions), return empty transactions array.

Return JSON only:
{
  "statement_type": "bank_statement" | "credit_card_statement",
  "period_start": "YYYY-MM-DD" | null,
  "period_end": "YYYY-MM-DD" | null,
  "summary": { ... } | null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "type": "credit" | "debit",
      "amount": 1234.56,
      "original_description": "...",
      "summary": "...",
      "category": "...",
      "category_confidence": 0.95
    }
  ]
}
```

### 3. Account Auto-Creation

When uploading a statement:

1. If `account_id` provided → use existing account
2. If no `account_id`:
   - LLM extracts account number, institution from statement
   - Check if account with same number exists for profile
   - If exists → use it
   - If not → create new account

**Account Detection Prompt (first page):**

```
Extract account information from this statement:

{first_page_text}

Return JSON:
{
  "account_type": "savings_account" | "credit_card" | ...,
  "institution": "HDFC Bank" | "Chase" | ...,
  "account_number": "1234567890",
  "account_holder_name": "John Doe"
}
```

### 4. Password Handling

1. User uploads password-protected PDF
2. Server tries to decrypt with:
   - Password provided in upload request
   - Saved password for the account (if account_id provided)
3. If decryption fails → return 422 with `password_required: true`
4. If decryption succeeds and password was new → save to account (encrypted)

### 5. Cross-Account Payment Linking

**Auto-Detection Rules:**

After parsing all transactions, scan for potential links:

1. **Credit Card Payments:**
   - Bank debit with description containing card issuer name + "CARD" or "PAYMENT"
   - Credit card credit with description "PAYMENT RECEIVED" or similar
   - Match by: similar date (±3 days), exact amount

2. **Internal Transfers:**
   - Bank debit with description "TRANSFER" or "NEFT" or "IMPS" + matching account
   - Bank credit on another account with similar date + amount

3. **Refunds:**
   - Credit card credit with "REFUND" in description
   - Matching earlier debit with similar amount + merchant

**Auto-Link Confidence:**
- Store suggested links with confidence score
- High confidence (>0.9): auto-link
- Medium confidence (0.7-0.9): suggest to user
- Low confidence (<0.7): ignore

---

## Encryption

### Application-Level Encryption

Sensitive fields encrypted using AES-256-GCM:
- `accounts.account_number`
- `accounts.statement_password`
- `investments.account_number`

**Environment Variable:**
```
ENCRYPTION_KEY=<32-byte-hex-string>
```

**Implementation:**
```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export function encrypt(text: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encrypted: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

---

## Background Job Queue

Simple in-memory queue for statement parsing.

```typescript
// lib/job-queue.ts
interface ParseJob {
  id: string
  statementId: string
  rawText: string
  pages: string[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
}

class JobQueue {
  private jobs: Map<string, ParseJob> = new Map()
  private processing: boolean = false

  async add(job: Omit<ParseJob, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const id = nanoid()
    this.jobs.set(id, {
      ...job,
      id,
      status: 'pending',
      createdAt: new Date()
    })
    this.processNext()
    return id
  }

  private async processNext() {
    if (this.processing) return

    const pending = Array.from(this.jobs.values())
      .find(j => j.status === 'pending')

    if (!pending) return

    this.processing = true
    pending.status = 'processing'

    try {
      await this.parseStatement(pending)
      pending.status = 'completed'
    } catch (error) {
      pending.status = 'failed'
      // Update statement record with error
    } finally {
      this.processing = false
      this.processNext()
    }
  }

  private async parseStatement(job: ParseJob) {
    // Page-by-page LLM parsing logic
  }
}

export const jobQueue = new JobQueue()
```

---

## Error Handling

### Parsing Failures

When parsing fails:
1. Delete any transactions created for this statement
2. Update statement status to 'failed'
3. Store error message in `statements.error_message`
4. Return error to user via status polling

### Common Error Cases

| Error | Response |
|-------|----------|
| Invalid file type | 400 Bad Request |
| Password required | 422 Unprocessable Entity |
| Wrong password | 422 Unprocessable Entity |
| LLM API error | 500 Internal Server Error (retry later) |
| Malformed PDF | 422 Unprocessable Entity |

---

## LLM Integration (Vercel AI SDK v6)

### Overview

We use [Vercel AI SDK](https://sdk.vercel.ai/) v6 for unified LLM access across multiple providers:
- **OpenAI** (GPT-4o, GPT-4o-mini)
- **Anthropic** (Claude 4 Sonnet, Claude 4 Haiku)
- **Google** (Gemini 2.0 Flash, Gemini 1.5 Pro)
- **Ollama** (local models - Llama, Mistral, etc.)

### Dependencies

```bash
bun add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google ollama-ai-provider
```

### Environment Variables

```env
# LLM Configuration
LLM_PROVIDER=openai                    # openai | anthropic | google | ollama
LLM_MODEL=gpt-4o-mini                  # model name (provider-specific)

# Provider API Keys (only needed for selected provider)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Custom API Base URL (for Ollama, Azure OpenAI, proxies, etc.)
LLM_API_BASE_URL=http://localhost:11434  # optional, provider-specific default used if not set
```

### LLM Client Factory

```typescript
// llm/index.ts
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOllama } from 'ollama-ai-provider'
import type { LanguageModelV1 } from 'ai'

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama'

interface LLMConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  apiBaseUrl?: string  // custom base URL (for Ollama, Azure, proxies, etc.)
}

export function createLLMClient(config?: Partial<LLMConfig>): LanguageModelV1 {
  const provider = config?.provider || process.env.LLM_PROVIDER || 'openai'
  const model = config?.model || process.env.LLM_MODEL || getDefaultModel(provider)
  const apiBaseUrl = config?.apiBaseUrl || process.env.LLM_API_BASE_URL

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
        baseURL: apiBaseUrl,  // supports Azure OpenAI, proxies
      })
      return openai(model)
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: apiBaseUrl,
      })
      return anthropic(model)
    }

    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: config?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        baseURL: apiBaseUrl,
      })
      return google(model)
    }

    case 'ollama': {
      const ollama = createOllama({
        baseURL: apiBaseUrl || 'http://localhost:11434/api',
      })
      return ollama(model)
    }

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`)
  }
}

function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini'
    case 'anthropic':
      return 'claude-sonnet-4-20250514'
    case 'google':
      return 'gemini-2.0-flash'
    case 'ollama':
      return 'llama3.2'
    default:
      return 'gpt-4o-mini'
  }
}

// Get available models for a provider (for settings UI)
export function getAvailableModels(provider: LLMProvider): string[] {
  switch (provider) {
    case 'openai':
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
    case 'anthropic':
      return ['claude-sonnet-4-20250514', 'claude-haiku-3-5-20241022', 'claude-3-5-sonnet-20241022']
    case 'google':
      return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
    case 'ollama':
      return ['llama3.2', 'llama3.1', 'mistral', 'mixtral', 'phi3', 'qwen2.5']
    default:
      return []
  }
}
```

### Structured Output with Zod Schemas

Using `generateObject` for reliable JSON extraction:

```typescript
// llm/schemas.ts
import { z } from 'zod'

// Transaction extraction schema
export const transactionSchema = z.object({
  date: z.string().describe('Transaction date in YYYY-MM-DD format'),
  type: z.enum(['credit', 'debit']).describe('Whether money came in or went out'),
  amount: z.number().positive().describe('Transaction amount (positive number)'),
  original_description: z.string().describe('Exact description from the statement'),
  summary: z.string().describe('Brief, clear summary of what this transaction is for'),
  category: z.string().describe('Category code from the provided list'),
  category_confidence: z.number().min(0).max(1).describe('Confidence in category assignment'),
})

export const bankStatementSummarySchema = z.object({
  type: z.literal('bank_statement'),
  opening_balance: z.number().optional(),
  closing_balance: z.number().optional(),
  total_credits: z.number().optional(),
  total_debits: z.number().optional(),
  credit_count: z.number().optional(),
  debit_count: z.number().optional(),
})

export const creditCardSummarySchema = z.object({
  type: z.literal('credit_card_statement'),
  credit_limit: z.number().optional(),
  available_limit: z.number().optional(),
  previous_balance: z.number().optional(),
  payments_received: z.number().optional(),
  new_charges: z.number().optional(),
  total_due: z.number().optional(),
  minimum_due: z.number().optional(),
  due_date: z.string().optional(),
  credit_count: z.number().optional(),
  debit_count: z.number().optional(),
})

export const pageParseResultSchema = z.object({
  statement_type: z.enum(['bank_statement', 'credit_card_statement']).optional(),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  summary: z.union([bankStatementSummarySchema, creditCardSummarySchema]).nullable().optional(),
  transactions: z.array(transactionSchema),
})

export const accountInfoSchema = z.object({
  account_type: z.string().describe('Type of account (savings_account, credit_card, etc.)'),
  institution: z.string().describe('Bank or financial institution name'),
  account_number: z.string().describe('Full account/card number'),
  account_holder_name: z.string().optional().describe('Name on the account'),
})

export type Transaction = z.infer<typeof transactionSchema>
export type PageParseResult = z.infer<typeof pageParseResultSchema>
export type AccountInfo = z.infer<typeof accountInfoSchema>
```

### Statement Parser Implementation

```typescript
// llm/parser.ts
import { generateObject } from 'ai'
import { createLLMClient } from './index'
import { pageParseResultSchema, accountInfoSchema, type PageParseResult, type AccountInfo } from './schemas'
import { getCategoriesForCountry } from '../lib/constants'

interface ParseOptions {
  countryCode: string
  pages: string[]
}

export async function parseStatementPage(
  pageText: string,
  countryCode: string,
  pageNumber: number
): Promise<PageParseResult> {
  const model = createLLMClient()
  const categories = getCategoriesForCountry(countryCode)
  const categoryList = categories.map(c => c.code).join(', ')

  const { object } = await generateObject({
    model,
    schema: pageParseResultSchema,
    prompt: `You are a financial document parser. Extract transactions from the following bank/credit card statement page.

Statement Text (Page ${pageNumber}):
---
${pageText}
---

Instructions:
1. Extract ALL transactions visible on this page
2. For each transaction, determine if it's a credit (money in) or debit (money out)
3. Amount should always be a positive number - the type field indicates direction
4. For the summary field, write a brief, clear description of what this transaction is (e.g., "Salary from Acme Corp", "Amazon purchase", "Electricity bill payment")
5. Assign a category from this list: ${categoryList}
6. If this page contains statement summary info (balances, due dates, etc.), extract it
7. If this page has no transactions (e.g., terms page), return empty transactions array

Important:
- Dates must be in YYYY-MM-DD format
- Be precise with amounts - include decimals
- category_confidence should reflect how certain you are (1.0 = very confident)`,
  })

  return object
}

export async function extractAccountInfo(firstPageText: string): Promise<AccountInfo> {
  const model = createLLMClient()

  const { object } = await generateObject({
    model,
    schema: accountInfoSchema,
    prompt: `Extract account information from this bank/credit card statement:

${firstPageText}

Look for:
- Account type (savings account, current account, credit card, etc.)
- Bank/institution name
- Account number or card number (full number)
- Account holder name`,
  })

  return object
}

export async function parseFullStatement(options: ParseOptions): Promise<{
  accountInfo: AccountInfo
  summary: PageParseResult['summary']
  transactions: PageParseResult['transactions'][]
  periodStart: string | null
  periodEnd: string | null
}> {
  const { countryCode, pages } = options

  // Extract account info from first page
  const accountInfo = await extractAccountInfo(pages[0])

  // Parse each page
  const pageResults: PageParseResult[] = []
  for (let i = 0; i < pages.length; i++) {
    const result = await parseStatementPage(pages[i], countryCode, i + 1)
    pageResults.push(result)
  }

  // Merge results
  const allTransactions = pageResults.flatMap(r => r.transactions)

  // Get summary from first page that has it
  const summary = pageResults.find(r => r.summary)?.summary || null

  // Get period dates
  const periodStart = pageResults.find(r => r.period_start)?.period_start || null
  const periodEnd = pageResults.find(r => r.period_end)?.period_end || null

  return {
    accountInfo,
    summary,
    transactions: allTransactions,
    periodStart,
    periodEnd,
  }
}
```

### LLM Settings Storage

Store user's LLM preferences in the database:

```sql
-- Add to users table or create separate llm_settings table
ALTER TABLE users ADD COLUMN llm_settings JSONB DEFAULT '{}';
```

```typescript
// LLM settings schema
interface LLMSettings {
  provider: 'openai' | 'anthropic' | 'google' | 'ollama'
  model: string
  apiKey?: string      // encrypted
  apiBaseUrl?: string  // custom base URL (for Ollama, Azure, proxies, etc.)
}
```

### API Endpoint for LLM Settings

```
GET    /api/settings/llm              -- Get current LLM settings
PUT    /api/settings/llm              -- Update LLM settings
GET    /api/settings/llm/models       -- Get available models for a provider
POST   /api/settings/llm/test         -- Test LLM connection
```

### Error Handling

```typescript
// llm/errors.ts
import { APICallError, RetryError } from 'ai'

export function handleLLMError(error: unknown): never {
  if (error instanceof APICallError) {
    if (error.statusCode === 401) {
      throw new Error('Invalid API key. Please check your LLM settings.')
    }
    if (error.statusCode === 429) {
      throw new Error('Rate limit exceeded. Please try again later.')
    }
    if (error.statusCode === 500) {
      throw new Error('LLM provider error. Please try again.')
    }
  }

  if (error instanceof RetryError) {
    throw new Error('Failed to connect to LLM after multiple attempts.')
  }

  throw error
}
```

---

## File Structure

```
apps/api/src/
├── db/
│   └── schema.*.ts              # Add accounts, statements, transactions, investments
├── lib/
│   ├── constants.ts             # Add account types, categories by country
│   ├── encryption.ts            # NEW: encryption utilities
│   └── job-queue.ts             # NEW: background job queue
├── services/
│   ├── accounts.ts              # NEW: account CRUD
│   ├── statements.ts            # NEW: statement upload, parsing
│   ├── transactions.ts          # NEW: transaction CRUD, linking
│   └── investments.ts           # NEW: investment CRUD
├── routes/
│   ├── accounts.ts              # NEW
│   ├── statements.ts            # NEW
│   ├── transactions.ts          # NEW
│   ├── investments.ts           # NEW
│   ├── categories.ts            # NEW
│   └── llm-settings.ts          # NEW: LLM configuration endpoints
└── llm/
    ├── index.ts                 # NEW: LLM client factory (Vercel AI SDK)
    ├── schemas.ts               # NEW: Zod schemas for structured output
    ├── parser.ts                # NEW: statement parsing logic
    └── errors.ts                # NEW: LLM error handling
```

---

## Security Considerations

1. **Encryption Key**: Must be set via `ENCRYPTION_KEY` env var before first use. Cannot be changed without re-encrypting all data.

2. **File Handling**: Statement files are held in memory during parsing only, never persisted to disk.

3. **Access Control**: All endpoints check that requested resources belong to the authenticated user.

4. **LLM Data**: Statement text is sent to LLM for parsing. Users should be aware of this if using external LLM providers (OpenAI, Anthropic). For privacy, use Ollama.

---

## Implementation Progress

### Phase 1: Database & Core ✅ COMPLETED
- [x] Add new tables to schema (`accounts`, `statements`, `transactions`, `investments`)
- [x] Implement encryption utilities (`lib/encryption.ts` - enhanced with optional helpers)
- [x] Add constants (account types, categories by country for IN & US)
- [x] Update `db/index.ts` to export new tables
- [x] Generate database migration

**Files created/modified:**
- `db/schema.pg.ts` - Added 4 new tables
- `db/schema.sqlite.ts` - Added 4 new tables
- `db/index.ts` - Added type exports and table references
- `lib/constants.ts` - Added account types, categories, investment types, LLM providers

### Phase 2: Accounts & Statements ✅ COMPLETED
- [x] Account CRUD service (`services/accounts.ts`)
- [x] Account routes (`routes/accounts.ts`)
- [x] Statement service with job queue (`services/statements.ts`)
- [x] Statement upload routes (`routes/statements.ts`)
- [x] PDF text extraction (`lib/file-parser.ts`)
- [x] Password-protected PDF handling
- [x] LLM client factory (`llm/index.ts`)
- [x] Zod schemas for structured output (`llm/schemas.ts`)
- [x] Statement parser (`llm/parser.ts`)

**Files created:**
- `services/accounts.ts` - Full CRUD with encryption
- `services/statements.ts` - Upload, status, job queue
- `routes/accounts.ts` - REST API endpoints
- `routes/statements.ts` - File upload, status polling
- `lib/file-parser.ts` - PDF/CSV text extraction
- `llm/index.ts` - Multi-provider LLM client (OpenAI, Anthropic, Google, Ollama)
- `llm/schemas.ts` - Zod schemas for transactions, summaries
- `llm/parser.ts` - Page-by-page parsing with deduplication

**Dependencies added:**
- `ai` (Vercel AI SDK v6)
- `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`
- `ollama-ai-provider-v2`
- `pdf-parse`

### Phase 3: Transactions ✅ COMPLETED
- [x] Transaction CRUD service (`services/transactions.ts`)
- [x] Transaction routes (`routes/transactions.ts`)
- [x] Cross-account linking (link/unlink, find candidates)
- [x] Categories endpoint (`routes/categories.ts`)
- [x] Transaction statistics endpoint

**Files created:**
- `services/transactions.ts` - Full CRUD, filtering, pagination, linking, stats
- `routes/transactions.ts` - REST API with filters, pagination, link management
- `routes/categories.ts` - Get categories for user's country

**Features:**
- Filter by profile, account, statement, category, type, date range, amount range
- Full-text search on description and summary
- Pagination with configurable limit (max 100)
- Sort by date, amount, or createdAt
- Category update (user can override LLM classification)
- Cross-account linking (payment, transfer, refund)
- Auto-find link candidates (same amount, opposite type, within 3 days)
- Transaction statistics with category breakdown

### Phase 4: Investments ✅ COMPLETED
- [x] Investment CRUD service (`services/investments.ts`)
  - Create, read, update, delete investments
  - Account number encryption
  - Portfolio summary with gain/loss calculations
  - Breakdown by type and currency
- [x] Investment routes (`routes/investments.ts`)
  - GET /api/investments - List investments (optional profileId filter)
  - GET /api/investments/types - Get investment types for user's country
  - GET /api/investments/summary - Portfolio summary stats
  - POST /api/investments - Create investment
  - GET /api/investments/:id - Get specific investment
  - PATCH /api/investments/:id - Update investment
  - DELETE /api/investments/:id - Delete investment

### Phase 5: LLM Settings ✅ COMPLETED
- [x] LLM settings storage in database (`services/config.ts`)
  - Uses existing `app_config` table with key-value storage
  - Encrypted storage for API keys (openai_api_key, anthropic_api_key, google_ai_api_key)
  - Settings: llm_provider, llm_model, llm_api_base_url
  - Priority: environment variables > database config
- [x] LLM settings routes (`routes/llm.ts`)
  - GET /api/llm/settings - Get current settings (API keys masked)
  - PUT /api/llm/settings - Update LLM configuration
  - GET /api/llm/providers - List available providers and models
  - POST /api/llm/test - Test LLM connection
- [x] Updated LLM client to use DB config
  - `createLLMClientFromSettings()` for background jobs
  - Parser now uses DB-stored settings

### Phase 6: Frontend ✅ COMPLETED
- [x] API client functions (`lib/api.ts`)
  - LLM settings API (get, update, providers, test)
  - Accounts API (CRUD)
  - Statements API (upload, list, status, delete)
  - Transactions API (list, filters, pagination, update, stats, categories)
  - Investments API (CRUD, types, summary)
- [x] UI Components
  - Added Select component (shadcn pattern)
- [x] LLM Settings page (`/settings/llm`)
  - Provider/model selection
  - API key management with secure storage
  - Connection test functionality
- [x] Accounts page (`/accounts`)
  - List accounts by profile
  - Create/edit/delete accounts
  - Account type selection (country-specific)
- [x] Statements page (`/statements`)
  - Drag & drop file upload
  - Account selection or auto-create
  - Password handling for protected PDFs
  - Real-time parsing status polling
- [x] Transactions page (`/transactions`)
  - Paginated transaction list
  - Search and filters (type, category, account, date range)
  - Stats cards (credits, debits, net)
  - Inline category/summary editing
- [x] Investments page (`/investments`)
  - Portfolio summary with gain/loss
  - Investment CRUD form
  - Country-specific investment types
- [x] Updated sidebar navigation with all new routes
