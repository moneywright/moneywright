# Investment Statement Parsing - Implementation Plan

## Overview

This document outlines the implementation plan for automated investment statement parsing, allowing users to upload PDF statements from various investment platforms (Zerodha, Groww, Vested, MF Central, PPF, EPF, NPS, etc.) and automatically extract holdings, transactions, and create historical snapshots for net worth tracking.

---

## User-Defined Requirements

Based on clarifying questions:

1. **Snapshots**: Both automatic (when parsing) AND manual updates supported
2. **Statement Types**: India-first (domestic + US stocks via Vested/INDmoney)
3. **Transactions**: Extract holdings AND individual buy/sell transactions
4. **Update Strategy**: New upload REPLACES all investments from same source
5. **Snapshot Linking**: Each source (Zerodha, Groww, etc.) has its own snapshot timeline
6. **Fixed Income**: Track interest credited from statements and add to principal
7. **Detection**: Auto-detect statement type from PDF content (LLM-powered)
8. **Parser Caching**: Yes, cache like bank statements
9. **Model Selection**: Same model selector as bank statements (parsing + categorization)
10. **Backward Compatibility**: Not needed - product not launched yet, clean slate
11. **Statement Storage**: Use same `statements` table with `document_type` column to differentiate
12. **Multi-currency**: Per-holding currency (each holding stores its own currency)
13. **Source Matching**: By `source_type` + `account_identifier` (allows multiple accounts per source type)

---

## Supported Statement Types

### India (Primary Focus)

#### Domestic Investments
| Source | Statement Type | Key Data Points |
|--------|---------------|-----------------|
| Zerodha | Holdings report, P&L statement | Stocks, ETFs, holdings, avg cost, current value |
| Groww | Portfolio statement | Stocks, MFs, bonds, holdings, NAV |
| MF Central / CAMS / Karvy | CAS (Consolidated Account Statement) | All mutual funds across AMCs, folios, units, NAV |
| PPF | Passbook statement | Balance, interest credited, yearly contributions |
| EPF | Passbook / UAN statement | Balance, employer/employee contributions, interest |
| NPS | Statement of Transactions | Tier I/II, units, NAV, contribution breakdown |
| Banks | FD statement / Interest certificate | Principal, interest rate, maturity date, interest earned |

#### US Stocks for Indian Investors
| Source | Statement Type | Key Data Points |
|--------|---------------|-----------------|
| Vested | Portfolio statement | US stocks/ETFs, holdings, avg cost in USD, INR equivalent |
| INDmoney | US stocks statement | US stocks/ETFs via DriveWealth, holdings, cost basis |

### USA (Future Phase)
| Source | Statement Type | Key Data Points |
|--------|---------------|-----------------|
| Schwab / Fidelity / TD | Brokerage statement | Holdings, transactions, dividends |
| 401k providers | Quarterly statement | Balance, contributions, vesting |
| IRA providers | Statement | Holdings, contributions, RMD |

---

## Data Model Changes

### 1. New Table: `investment_sources`

Represents a recognized investment platform/source.

```
investment_sources
├── id (string, PK)
├── profile_id (FK)
├── user_id (FK)
├── source_type (enum: zerodha, groww, mf_central, cams, kfintech, vested, indmoney, ppf, epf, nps, fd, manual, other)
├── source_name (string) - Display name like "Zerodha - Equity"
├── institution (string | null) - Bank/broker name
├── account_identifier (string | null, encrypted) - Demat ID, folio, etc.
├── country_code (string) - IN, US
├── currency (string) - INR, USD
├── last_statement_date (date | null) - Date of most recent statement
├── last_sync_at (timestamp | null)
├── created_at (timestamp)
├── updated_at (timestamp)
```

### 2. New Table: `investment_holdings`

Current holdings extracted from statements. One row per holding per source.

```
investment_holdings
├── id (string, PK)
├── source_id (FK → investment_sources)
├── profile_id (FK)
├── user_id (FK)
├── investment_type (enum: stock, mutual_fund, etf, bond, ppf, epf, nps, fd, gold, other)
├── symbol (string | null) - Stock ticker, scheme code
├── name (string) - Full name of instrument
├── isin (string | null) - ISIN code if available
├── units (decimal) - Current units/shares
├── average_cost (decimal | null) - Avg buy price per unit
├── current_price (decimal | null) - Latest NAV/price
├── current_value (decimal) - units × current_price
├── invested_value (decimal | null) - units × average_cost
├── gain_loss (decimal | null) - current - invested
├── gain_loss_percent (decimal | null)
├── folio_number (string | null) - For mutual funds
├── maturity_date (date | null) - For FD, bonds
├── interest_rate (decimal | null) - For FD, PPF
├── currency (string)
├── as_of_date (date) - Date this holding data is from
├── created_at (timestamp)
├── updated_at (timestamp)

Index: (source_id, symbol) for upserts
```

### 3. New Table: `investment_transactions`

Buy/sell/dividend transactions extracted from statements.

```
investment_transactions
├── id (string, PK)
├── source_id (FK → investment_sources)
├── holding_id (FK → investment_holdings | null) - Linked holding if exists
├── profile_id (FK)
├── user_id (FK)
├── transaction_type (enum: buy, sell, dividend, interest, sip, switch_in, switch_out, contribution, withdrawal)
├── symbol (string | null)
├── name (string)
├── units (decimal | null) - Units bought/sold
├── price_per_unit (decimal | null) - Price at transaction
├── amount (decimal) - Total transaction value
├── fees (decimal | null) - Brokerage, STT, etc.
├── transaction_date (date)
├── settlement_date (date | null)
├── description (string | null) - Original description from statement
├── currency (string)
├── hash (string) - For deduplication (date|symbol|amount|type)
├── created_at (timestamp)

Unique constraint: (source_id, hash)
```

### 4. New Table: `investment_snapshots`

Historical portfolio value snapshots per source.

```
investment_snapshots
├── id (string, PK)
├── source_id (FK → investment_sources)
├── profile_id (FK)
├── user_id (FK)
├── snapshot_date (date) - Date of snapshot
├── snapshot_type (enum: statement_import, manual, scheduled)
├── total_invested (decimal) - Sum of invested values
├── total_current (decimal) - Sum of current values
├── total_gain_loss (decimal)
├── gain_loss_percent (decimal)
├── holdings_count (integer)
├── holdings_detail (json) - Snapshot of all holdings [{symbol, name, units, value}, ...]
├── currency (string)
├── created_at (timestamp)

Unique constraint: (source_id, snapshot_date) - One snapshot per source per day
```

### 5. Replace Existing: `investments` table

**Decision**: Since the product is not yet launched, we will DELETE the existing `investments` table and replace it with the new `investment_holdings` table. This simplifies the data model - no need to aggregate across two tables.

The new `investment_holdings` table handles both:
- Imported holdings from statement parsing
- Manual entries (source_id can be null for manual entries, or create a "manual" source)

### 6. Modify Existing: `statements` table

Add columns to support investment statements in the same table:

```
statements (existing table - add columns)
├── document_type (enum: 'bank_statement', 'credit_card_statement', 'investment_statement') - NEW
├── source_id (FK → investment_sources | null) - NEW, for investment statements
├── holdings_count (integer | null) - NEW, number of holdings parsed
```

**Why same table?**
- Unified upload history view
- Reuse existing status tracking (pending, parsing, completed, failed)
- Reuse file metadata (filename, size, upload date)
- Simple frontend - one statements page shows all uploads

**Linking**:
- Bank/credit card statements: `account_id` points to `accounts` table
- Investment statements: `source_id` points to `investment_sources` table

---

## Processing Pipeline

### Unified Upload Flow

**Single upload endpoint** handles both bank statements and investment statements:

```
POST /statements/upload
```

The flow branches based on auto-detection:

```
User uploads PDF
       ↓
Extract text from PDF
       ↓
LLM detects document type ──────────────────┐
       ↓                                     ↓
   Is it a bank/                        Is it an investment
   credit card statement?               statement?
       ↓                                     ↓
   Existing flow:                       New flow:
   - Create/find account                - Create/find investment_source
   - Parse transactions                 - Parse holdings
   - Categorize                         - Create snapshot
   - Update statement record            - Update source record
```

### Step 1: Upload & Detection

1. User uploads PDF via statements page (same UI, same endpoint)
2. Extract text from PDF using existing `extractPdfText()`
3. **MODIFY** existing `extractAccountInfo()` LLM call:
   - Add `document_type` field to the schema
   - For bank/credit card: returns existing fields (account_type, institution_id, etc.)
   - For investment: returns investment-specific fields (source_type, source_name, etc.)
   - **One LLM call does both detection AND metadata extraction**

4. Branch based on `document_type`:

   **If bank_statement / credit_card_statement:**
   - Continue with existing flow (unchanged)
   - Uses `account_id` linking

   **If investment_statement:**
   - Create or find matching `investment_sources` record
   - Branch to investment parsing flow
   - Uses `source_id` linking

### Step 2: Parser Selection

Same approach as bank statements - LLM-generated parsers with caching:

1. Check if we have cached parser code for this source_type (e.g., `inv_parser_zerodha_v001`)
2. If yes, try cached versions in order (latest first)
3. If no cache or all cached versions fail, generate new parser code with LLM
4. Cache successful parser code for future use

### Step 3: Holdings Extraction

For each statement type, extract:
- List of holdings with symbol, name, units, avg cost, current value
- Statement date (as_of_date)

**Key difference from bank statements**: Investment statements don't have "transactions" in a running balance sense. They have:
- Current holdings (point-in-time snapshot)
- Transaction history (if included in statement)

### Step 4: Transaction Extraction (if available)

Some statements include transaction history:
- P&L reports: Individual trades
- MF statements: SIP transactions, switches
- PPF/EPF: Yearly contributions and interest

Extract when available, with hash-based deduplication.

### Step 5: Source Update Strategy (Replace All)

When importing a new statement for an existing source:

1. Start database transaction
2. Mark all existing holdings for this source as "stale"
3. Upsert new holdings (match by symbol + source_id)
4. Delete holdings not in new statement (removed from portfolio)
5. Create snapshot for this date
6. Update source's `last_statement_date`
7. Commit transaction

### Step 6: Snapshot Creation

After parsing completes:
1. Calculate totals from all holdings for this source
2. Create `investment_snapshots` record with date from statement
3. Store holdings_detail JSON for historical reference

---

## LLM Schemas

### Unified Document Info Schema (Modified accountInfoSchema)

Extend the existing `accountInfoSchema` to handle all document types in one call:

```typescript
export const documentInfoSchema = z.object({
  // NEW: Document type detection
  document_type: z.enum(['bank_statement', 'credit_card_statement', 'investment_statement']),

  // === For bank_statement / credit_card_statement (existing fields) ===
  account_type: z.string().nullable(),
  institution_id: z.string().nullable(),
  institution_name: z.string().nullable(),
  account_number: z.string().nullable(),
  account_holder_name: z.string().nullable(),
  product_name: z.string().nullable(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  summary: statementSummarySchema.nullable(),
  // ... other existing fields for credit cards

  // === For investment_statement (new fields) ===
  source_type: z.enum([
    // India - Domestic
    'zerodha', 'groww', 'mf_central', 'cams', 'kfintech',
    'ppf', 'epf', 'nps', 'fd',
    // India - US Stocks platforms
    'vested', 'indmoney',
    // Fallback
    'other'
  ]).nullable(),
  source_name: z.string().nullable().describe('Human-readable source name, e.g., "Zerodha Holdings"'),
  account_identifier: z.string().nullable().describe('Demat ID, folio, PAN, Client ID, etc.'),
  statement_date: z.string().nullable().describe('Statement as-of date in YYYY-MM-DD'),
  has_holdings: z.boolean().nullable(),
  has_transactions: z.boolean().nullable(),
})
```

**Note**: Fields are nullable so the LLM only fills relevant ones based on document_type.

### Investment Holdings Schema

```typescript
export const investmentHoldingSchema = z.object({
  investment_type: z.enum(['stock', 'mutual_fund', 'etf', 'bond', 'ppf', 'epf', 'nps', 'fd', 'gold', 'other']),
  symbol: z.string().nullable(),
  name: z.string(),
  isin: z.string().nullable(),
  units: z.number(),
  average_cost: z.number().nullable(),
  current_price: z.number().nullable(),
  current_value: z.number(),
  invested_value: z.number().nullable(),
  folio_number: z.string().nullable(),
  maturity_date: z.string().nullable(),
  interest_rate: z.number().nullable(),
})

export const investmentHoldingsResultSchema = z.object({
  statement_date: z.string(),
  holdings: z.array(investmentHoldingSchema),
  summary: z.object({
    total_invested: z.number().nullable(),
    total_current: z.number(),
    total_gain_loss: z.number().nullable(),
    holdings_count: z.number(),
  }),
})
```

### Investment Transaction Schema

```typescript
export const investmentTransactionSchema = z.object({
  transaction_type: z.enum(['buy', 'sell', 'dividend', 'interest', 'sip', 'switch_in', 'switch_out', 'contribution', 'withdrawal']),
  transaction_date: z.string(),
  symbol: z.string().nullable(),
  name: z.string(),
  units: z.number().nullable(),
  price_per_unit: z.number().nullable(),
  amount: z.number(),
  fees: z.number().nullable(),
  description: z.string().nullable(),
})
```

---

## Frontend Changes

### Statements Page Modifications

1. Add a toggle/tabs: "Bank Statements" | "Investment Statements"
2. When uploading, auto-detect if it's a bank or investment statement
3. Show appropriate cards for each type

### Investment Sources Section (New)

Add to investments page:
- Show linked sources with last sync date
- Allow re-upload to refresh a source
- Show snapshot history per source

### Net Worth Chart Integration

Use snapshots to build:
- Timeline of portfolio value by source
- Aggregate net worth = bank balances + investment values
- Show in dashboard summary

---

## API Endpoints

### New Endpoints

```
POST /investments/upload
  - Upload investment statement PDF
  - Returns: { sourceId, holdingsCount, transactionsCount, snapshotId }

GET /investment-sources
  - List all investment sources for user
  - Returns: { sources: InvestmentSource[] }

GET /investment-sources/:id
  - Get source details with latest holdings
  - Returns: { source, holdings: InvestmentHolding[] }

GET /investment-sources/:id/snapshots
  - Get snapshot history for a source
  - Returns: { snapshots: InvestmentSnapshot[] }

POST /investment-sources/:id/snapshot
  - Create manual snapshot (user updates current values)
  - Body: { holdings: [{symbol, currentValue}, ...] }

GET /investment-holdings?sourceId=xxx
  - Get current holdings, optionally filtered by source

GET /investment-transactions?sourceId=xxx&startDate=xxx&endDate=xxx
  - Get transactions with date range filter
```

---

## Parser Strategy

### Same Approach as Bank Statements

Use the **exact same approach** as bank/credit card statements:

1. LLM generates parser code based on the statement content
2. Parser code is cached in `app_config` table
3. Cached parsers are tried first, regenerate if all fail

### Cache Key Format

```
inv_parser_{source_type}_{version}
```

Examples:
- `inv_parser_zerodha_v001`
- `inv_parser_groww_v002`
- `inv_parser_mf_central_v001`
- `inv_parser_vested_v001`

### Parser Code Generation

The LLM generates JavaScript code that:
- Receives statement text as input
- Parses holdings (symbol, name, units, avg cost, current value)
- Optionally parses transactions if present
- Returns structured data matching our schemas

### Validation

Similar to bank statements, validate parsed output:
- Check if totals match summary (if available in statement)
- Verify required fields are present
- Ensure numeric values are reasonable

### Difference from Bank Statements

The **system prompt** will be different:
- Bank statements: Extract transactions with date, amount, type, description, running balance
- Investment statements: Extract holdings with symbol, units, cost, value + optionally transactions

---

## Migration Strategy

**Simplified approach** (product not yet launched):

1. DELETE existing `investments` table completely
2. Create new tables: `investment_sources`, `investment_holdings`, `investment_transactions`, `investment_snapshots`
3. Update all investment-related routes and services to use new tables
4. Update frontend to work with new API structure

No backward compatibility needed - clean slate.

---

## Interest Tracking for Fixed Income

For PPF, FD, EPF:

1. Parse interest credited from statement
2. Create transaction record: `type: 'interest'`
3. Update holding with new balance = previous + interest
4. Snapshot includes updated balance

---

## Error Handling

1. If statement type detection fails → ask user to specify manually
2. If holdings extraction fails → show what was extracted, let user correct
3. If duplicate statement → warn but allow re-import (replace strategy)
4. Partial parsing → create holdings that parsed, mark source as "partial"

---

## Implementation Order

### Phase 1: Core Infrastructure
- [ ] Delete existing `investments` table and related code
- [ ] Create new database tables (sources, holdings, transactions, snapshots)
- [ ] Modify `statements` table (add document_type, source_id, holdings_count)
- [ ] Modify `accountInfoSchema` to unified `documentInfoSchema`
- [ ] Create investment holdings/transactions extraction schemas
- [ ] Implement LLM-based parser code generation for investments
- [ ] Implement parser caching in `app_config`
- [ ] Modify upload endpoint to branch based on document_type
- [ ] Implement investment parsing flow
- [ ] Implement replace-all update strategy for sources
- [ ] Implement snapshot creation on successful parse

### Phase 2: Frontend Integration
- [ ] Update statements page to show both bank and investment statements
- [ ] Update investments page with sources view and holdings display
- [ ] Add snapshot history UI
- [ ] Manual entry support (create "Manual" source type)
- [ ] Integrate with dashboard net worth

### Phase 3: Advanced Features
- [ ] Transaction history extraction from statements
- [ ] Manual snapshot creation
- [ ] Gain/loss reports
- [ ] Interest tracking for fixed income (PPF, FD, EPF)
- [ ] Tax-relevant reports (STCG/LTCG for India)

---

## Implementation Progress

### Phase 1 Progress
_Not started_

---

## Open Questions / Future Considerations

1. **Price updates**: Should we fetch live prices from APIs (Zerodha Kite, etc.)?
   - For now: No, only use prices from statements
   - Future: Optional price refresh integration

2. **Multiple currencies**: How to handle when user has INR and USD investments?
   - Store in original currency
   - Convert at display time using exchange rate
   - Net worth shown in user's preferred currency

3. **SGB (Sovereign Gold Bonds)**: Special handling?
   - Treat as bonds with gold-linked value
   - Parser extracts units (grams) and current value

4. **Insurance (ULIP, LIC)**: Support later?
   - Phase 2/3 consideration
   - Extract surrender value as current value

---

## Summary

This implementation transforms the investment tracking from manual entry to automated statement parsing, while:
- Maintaining source-level isolation (each platform has its own timeline)
- Supporting both equity and fixed-income instruments
- Creating historical snapshots for net worth charting
- Providing a "replace all" update strategy for simplicity
- Using template-based parsers where possible, LLM fallback for unknown formats
