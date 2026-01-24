# AI Chat Feature Implementation

## Overview

AI-powered chat interface for Moneywright that allows users to interact with their financial data using natural language. The chat supports querying transactions, accounts, investments, and stats, as well as modifying transaction categories/summaries with user confirmation.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Chat History | Persist in database |
| Write Actions | Not supported (read-only agent) |
| UI Location | Dedicated page (`/chat`) |
| Code Execution | E2B sandbox for Python |
| Chat Scope | Profile-scoped (multiple conversations per profile) |
| Context Management | Smart summarization for long conversations (planned) |
| Model Selection | User can choose model per message |
| Thinking/Reasoning | Supported for compatible models |

---

## Implementation Status

### Completed

#### Database & Backend
- [x] Chat schema (conversations, messages) in SQLite
- [x] Conversation CRUD operations (create, list, get, delete)
- [x] Message persistence with tool calls, tool results, and reasoning steps
- [x] SSE streaming for real-time responses
- [x] ToolLoopAgent integration with AI SDK v6
- [x] Multi-provider support (OpenAI, Anthropic, Google, Vercel Gateway, Ollama)
- [x] Thinking/reasoning support across all providers
- [x] Query cache for tool data persistence
- [x] Debug logging for messages and tool calls

#### Tools Implemented (Read-Only)

**Data Tools** (return CSV format with pagination, 250 rows per page):
- [x] `getTransactions` - Query transactions with filters, returns CSV data
- [x] `getAccounts` - List accounts with balances
- [x] `getHoldings` - Investment holdings (stocks, mutual funds, ETFs)
- [x] `getInvestmentSources` - List investment platforms
- [x] `getSubscriptions` - Detected recurring subscriptions

**Summary Tools** (aggregated data, no pagination):
- [x] `getNetWorth` - Calculate net worth from account balances
- [x] `getInvestmentSummary` - Portfolio summary with gains/losses
- [x] `getTransactionStats` - Income/expense stats with category breakdown
- [x] `getMonthlyTrends` - Monthly income/expense trends

**Code Execution**:
- [x] `executeCode` - Python code execution in E2B sandbox (charts, tables, values)

**Web Tools** (requires TAVILY_API_KEY):
- [x] `webSearch` - Search for current market data, news, stock prices
- [x] `webExtract` - Extract content from URLs

**Note:** Write operations were removed. The AI agent is read-only.

#### Frontend
- [x] Chat page at `/chat` route
- [x] Conversation history sidebar (sheet drawer)
- [x] Message rendering with markdown support
- [x] Chain of Thought display with collapsible reasoning
- [x] Tool call visualization with icons and badges
- [x] Real-time streaming display
- [x] Model selector dropdown
- [x] Thinking level selector (off/low/medium/high)
- [x] Error display
- [x] Responsive layout (full width mobile, 3xl desktop)
- [x] Shimmer loading effect for processing state

#### UI Polish
- [x] Unified shimmer animation (gradient sweep across icon + text)
- [x] Proper tool labels ("Fetching/Found" instead of "Analyzing")
- [x] BrainCircuit icon for CoT header, Brain icon for thinking steps
- [x] Display ALL tool call arguments as badges
- [x] Improved system prompt for better LLM response formatting
- [x] Data table rendering via `<data-table query-id="xxx" />` custom tag

---

### Pending / Not Implemented

#### Medium Priority
- [ ] **Conversation Summarization** - Compress older messages to prevent context overflow
  - Schema has `summary` and `summary_up_to_message_id` fields (not used)
  - Need summarization service that compresses messages > N turns old

- [ ] **Image Upload** - Multimodal support for screenshots
  - Need file upload endpoint
  - Need to convert images to base64 for AI SDK
  - UI for image attachment in prompt input

- [ ] **Conversation Title Auto-Generation** - Generate titles from first user message
  - Currently uses first 100 chars of first message
  - Could use LLM to generate better title

#### Low Priority / Nice to Have
- [ ] **Quick Prompts** - Suggested prompts in empty state
- [ ] **Conversation Search** - Search across conversation history
- [ ] **Export Chat** - Export conversation as markdown/PDF
- [ ] **Rate Limiting** - Prevent abuse of LLM API calls

---

## Architecture

### File Structure

```
apps/api/src/
├── routes/
│   └── chat.ts                 # Chat API endpoints (SSE streaming)
├── services/
│   └── chat/
│       ├── index.ts            # Main exports
│       ├── agent.ts            # ToolLoopAgent creation
│       ├── tools.ts            # Tool definitions (10 tools)
│       ├── types.ts            # Types + storedToModelMessages
│       ├── prompt.ts           # System prompt builder
│       ├── query-cache.ts      # Query cache with full data storage
│       ├── code-executor.ts    # E2B Python code execution
│       └── conversations.ts    # Conversation CRUD
└── db/
    └── schema.*.ts             # Chat tables

apps/web/src/
├── routes/
│   └── chat.tsx                # Main chat page
├── components/
│   └── ai-elements/
│       ├── chain-of-thought.tsx   # CoT display component
│       ├── message.tsx            # Message rendering
│       ├── prompt-input.tsx       # Input with model selector
│       ├── dynamic-chart.tsx      # Recharts rendering from JSON
│       ├── dynamic-table.tsx      # Table rendering from executeCode
│       └── query-data-table.tsx   # Interactive table for <data-table> tags
├── hooks/
│   └── useChat.ts              # Chat state and SSE streaming
└── lib/
    └── api.ts                  # Chat API client with SSE parsing
```

### SSE Event Types

| Event | Description |
|-------|-------------|
| `reasoning` | Thinking/reasoning content (streaming) |
| `text` | Assistant text response (streaming) |
| `tool-call` | Tool invocation with args |
| `tool-result` | Tool execution result |
| `done` | Stream complete |
| `error` | Error occurred |

### Thinking/Reasoning Config by Provider

```typescript
// OpenAI (o1, o3 models)
{ openai: { reasoningEffort: 'low' | 'medium' | 'high', reasoningSummary: 'auto' } }

// Anthropic (Claude with extended thinking)
{ anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } } }

// Google (Gemini 2.5 / 3)
{ google: { thinkingConfig: { thinkingBudget: 10000, includeThoughts: true } } }
// OR for Gemini 3
{ google: { thinkingConfig: { thinkingLevel: 'medium', includeThoughts: true } } }

// Vercel Gateway - pass ALL provider options, gateway routes to correct one
{ openai: {...}, anthropic: {...}, google: {...} }
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/config` | Get available providers and models |
| GET | `/api/chat/profiles/:profileId/conversations` | List conversations |
| POST | `/api/chat/profiles/:profileId/conversations` | Create conversation |
| GET | `/api/chat/conversations/:id` | Get conversation with messages |
| DELETE | `/api/chat/conversations/:id` | Delete conversation |
| DELETE | `/api/chat/conversations/:id/messages` | Clear messages |
| POST | `/api/chat/conversations/:id/messages` | Send message (SSE) |
| GET | `/api/chat/query/:queryId` | Get full query data from cache |

---

## E2B Code Execution

The `executeCode` tool allows LLM to run Python code for custom analysis and chart generation.

### Data Flow

```
1. User: "Show me spending by category as a pie chart"
2. LLM calls queryTransactions() → returns queryId + summary + schema
3. LLM calls executeCode(code, queryIds=[queryId], outputType='chart')
4. Backend:
   - Loads full data from query cache by queryId
   - Injects data as `data_<queryId>` and `df_<queryId>` (pandas DataFrame)
   - Executes Python code in E2B sandbox
   - Validates output format (chart/table/value)
5. Frontend renders DynamicChart or DynamicTable component
```

### Query Cache

Full query results are stored in `chat_query_cache` table:
- `dataType`: 'transactions' | 'holdings' | 'accounts' | etc.
- `data`: JSON array of full results (max 1MB, truncated if larger)
- `schema`: Field definitions for LLM reference
- Permanent storage (no expiration) - used for displaying data in chat history

### Output Types

**Chart** (Recharts JSON):
```python
result = {
    "type": "pie",  # bar, line, area, pie
    "data": [{"category": "Food", "amount": 5000}, ...],
    "config": {"xKey": "category", "yKey": "amount", "title": "Spending"}
}
```

**Table**:
```python
result = {
    "columns": [{"key": "name", "label": "Name"}, ...],
    "rows": [{"name": "Food", "amount": 5000}, ...]
}
```

**Value** (any JSON-serializable):
```python
result = {"total": 50000, "average": 2500}
```

### Requirements

- Set `E2B_API_KEY` environment variable
- Queries must be run first to populate cache
- Max execution time: 60 seconds

---

## Data Table Display

When the user asks to see "all transactions" or "complete list", the LLM can use a custom HTML tag to display an interactive table with the full query data.

### Syntax

The LLM includes this tag in its response:
```
<data-table query-id="transactions_1234567890_abc123" />
```

### Data Flow

```
1. User: "Show me all my food transactions"
2. LLM calls queryTransactions(category="food") → returns queryId + summary
3. LLM includes <data-table query-id="..." /> in response
4. Frontend:
   - Parses the tag from markdown content
   - Fetches full data from GET /api/chat/query/:queryId
   - Renders QueryDataTable component with pagination and sorting
```

### Features

- **Pagination**: 20 items per page with navigation
- **Sorting**: Click column headers to sort asc/desc
- **Smart Columns**: Shows relevant columns based on data type (transactions, holdings, accounts)
- **Type-aware Formatting**: Currency, dates, percentages formatted appropriately
- **Color Coding**: Credit/debit transactions, gain/loss values highlighted

### Query Cache

Full query results are stored in `chat_query_cache` table:
- Permanent storage (no expiration) - needed for chat history display
- Max 1MB data (truncated if larger)
- Includes schema for column definitions

---

## Next Steps (Recommended Order)

1. **Bulk Update Execution** - Implement the actual execution logic for `bulkUpdateTransactions`
   - Location: `apps/api/src/routes/chat.ts` (execute-action endpoint, line ~633)
   - Need to fetch transactions by filters and update them in a loop

2. **Conversation Summarization** - Prevent context overflow
   - Add background job or on-demand summarization
   - Store summary in conversation record
   - Inject summary into system prompt for older conversations

3. **Image Upload** - Add multimodal support
   - Add upload endpoint
   - Store images temporarily or in blob storage
   - Pass to AI SDK as base64

---

## Testing Checklist

### Core Functionality
- [x] Create conversation
- [x] Send message and receive streaming response
- [x] Model switching mid-conversation
- [x] Thinking toggle on/off
- [x] Verify reasoning/thinking display
- [x] Conversation persistence and reload
- [x] Delete conversation

### Tool Flows (Read-Only)
- [x] Query transactions with filters
- [x] Get account information
- [x] Get net worth
- [x] Get investment summary
- [x] Get monthly trends
- [x] Get subscriptions

### Code Execution (requires E2B_API_KEY)
- [ ] Generate pie chart from spending data
- [ ] Generate bar chart from monthly trends
- [ ] Generate table output
- [ ] Generate value output (calculations)

### Data Table Display
- [ ] LLM uses <data-table> tag when asked for complete list
- [ ] Table renders with correct columns for data type
- [ ] Pagination works (next/prev/first/last)
- [ ] Sorting by column headers works
- [ ] Loading and error states display correctly

### Not Yet Testable
- [ ] Image upload (not implemented)
