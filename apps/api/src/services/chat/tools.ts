/**
 * AI Chat Tools Definition
 *
 * Defines all tools available to the AI chat agent.
 * Tools reuse existing service functions - no logic duplication.
 *
 * Data Format:
 * - All data tools return { totalCount, queryId, data, page, hasMore }
 * - `data` is CSV format to reduce tokens while giving full access
 * - Pagination: 250 rows per page, use queryId + page to fetch more
 *
 * Web Search:
 * - Uses a wrapper approach to avoid provider tool mixing issues
 * - The web_search tool internally calls generateText with native search tools
 * - This works around Google's limitation of not mixing provider tools with custom tools
 */

import { tool, generateText, gateway } from 'ai'
import { z } from 'zod'
import { tavily } from '@tavily/core'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import type { AIProvider } from './types'
import { logger } from '../../lib/logger'
import { createLLMClient } from '../../llm'
import {
  storeQueryCache,
  generateQueryId,
  buildTransactionSchema,
  buildHoldingsSchema,
  buildAccountsSchema,
  getQueryCache,
} from './query-cache'
import { executeCode as runCodeInSandbox, isE2BConfigured } from './code-executor'

// Import existing service functions
import {
  getTransactions,
  getCategoryBreakdown,
  getMonthlyTrends,
  getDetectedSubscriptions,
  type TransactionFilters,
} from '../transactions'
import { getAccountsWithBalances, calculateNetWorth } from '../accounts'
import { getHoldingsByUserId, getInvestmentSummary } from '../investment-holdings'
import { getSourcesByUserId } from '../investment-sources'
import { getPoliciesByUser, getPolicyById, type PolicyFilters } from '../insurance'

/** Page size for paginated results */
const PAGE_SIZE = 250

/**
 * Check if Tavily is configured
 */
export function isTavilyConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY
}

/**
 * Create Tavily client (lazily instantiated)
 */
let tavilyClient: ReturnType<typeof tavily> | null = null
function getTavilyClient() {
  if (!tavilyClient && isTavilyConfigured()) {
    tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! })
  }
  return tavilyClient
}

/**
 * Context for tools
 */
interface ToolContext {
  profileId: string | null // null = family view (all profiles)
  userId: string
  provider: AIProvider
  model: string
  apiKey?: string // API key for provider (used for internal search calls)
}

/**
 * Determine the search type based on provider
 */
function getSearchType(
  provider: AIProvider
): 'openai' | 'anthropic' | 'google' | 'perplexity' | 'tavily' | null {
  if (provider === 'openai') return 'openai'
  if (provider === 'anthropic') return 'anthropic'
  if (provider === 'google') return 'google'
  if (provider === 'vercel') return 'perplexity' // Gateway uses Perplexity
  if (provider === 'ollama' && isTavilyConfigured()) return 'tavily'
  return isTavilyConfigured() ? 'tavily' : null
}

/**
 * Execute web search using native provider tools via generateText wrapper
 * This approach avoids the "cannot mix provider tools with custom tools" limitation
 * Uses the user's model configuration for the internal search call
 */
async function executeWebSearch(
  query: string,
  searchType: NonNullable<ReturnType<typeof getSearchType>>,
  context: { provider: AIProvider; model: string; apiKey?: string }
): Promise<{ results: Array<{ title?: string; url?: string; content: string }>; error?: string }> {
  const searchPrompt = `Search the web for: "${query}"\n\nReturn the search results with relevant information.`

  try {
    // Create model using user's configuration
    const model = createLLMClient({
      provider: context.provider,
      model: context.model,
      apiKey: context.apiKey,
    })

    if (searchType === 'openai') {
      const result = await generateText({
        // Provider tools require type assertion due to SDK type limitations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: model as any,
        prompt: searchPrompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: { webSearch: openai.tools.webSearch({}) } as any,
      })
      const sources = (result as { sources?: Array<{ url: string }> }).sources || []
      return {
        results:
          sources.length > 0
            ? sources.map((s) => ({ url: s.url, content: s.url }))
            : [{ content: result.text || 'No results found' }],
      }
    }

    if (searchType === 'anthropic') {
      const result = await generateText({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: model as any,
        prompt: searchPrompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: { webSearch: anthropic.tools.webSearch_20250305({ maxUses: 3 }) } as any,
      })
      return { results: [{ content: result.text || 'No results found' }] }
    }

    if (searchType === 'google') {
      const result = await generateText({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: model as any,
        prompt: searchPrompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: { google_search: google.tools.googleSearch({}) } as any,
      })
      return { results: [{ content: result.text || 'No results found' }] }
    }

    if (searchType === 'perplexity') {
      const result = await generateText({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: model as any,
        prompt: searchPrompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: { perplexity_search: gateway.tools.perplexitySearch({ maxResults: 5 }) } as any,
      })

      // Check tool results for search data
      if (result.toolResults && result.toolResults.length > 0) {
        const searchResults: Array<{ title?: string; url?: string; content: string }> = []
        for (const tr of result.toolResults) {
          const output =
            (tr as { result?: unknown; output?: unknown }).result ||
            (tr as { result?: unknown; output?: unknown }).output
          if (output && typeof output === 'object') {
            const outputObj = output as {
              results?: Array<{
                title?: string
                url?: string
                snippet?: string
                content?: string
                text?: string
              }>
            }
            if (Array.isArray(outputObj.results)) {
              for (const r of outputObj.results) {
                searchResults.push({
                  title: r.title,
                  url: r.url,
                  content: r.snippet || r.content || r.text || JSON.stringify(r),
                })
              }
            }
          }
        }
        if (searchResults.length > 0) {
          return { results: searchResults }
        }
      }

      return { results: [{ content: result.text || 'No results found' }] }
    }

    if (searchType === 'tavily') {
      // Use Tavily directly (not via generateText)
      const client = getTavilyClient()
      if (!client) {
        return { results: [], error: 'Tavily not configured' }
      }
      const response = await client.search(query, {
        maxResults: 5,
        includeAnswer: true,
        searchDepth: 'basic',
      })
      return {
        results: [
          ...(response.answer ? [{ content: response.answer }] : []),
          ...response.results.map((r) => ({
            title: r.title,
            url: r.url,
            content: r.content,
          })),
        ],
      }
    }

    return { results: [], error: 'Unknown search type' }
  } catch (error) {
    logger.error('[WebSearch] Search failed:', error)
    return {
      results: [],
      error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Convert array of objects to CSV string
 */
function toCSV<T extends Record<string, unknown>>(data: T[], columns?: string[]): string {
  if (data.length === 0) return ''

  // Get columns from first row if not specified
  const cols = columns || Object.keys(data[0] as Record<string, unknown>)

  // Build header
  const header = cols.join(',')

  // Build rows
  const rows = data.map((row) =>
    cols
      .map((col) => {
        const value = row[col]
        if (value === null || value === undefined) return ''
        if (typeof value === 'string') {
          // Escape quotes and wrap in quotes if contains comma, newline, or quote
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }
        return String(value)
      })
      .join(',')
  )

  return [header, ...rows].join('\n')
}

/**
 * Get paginated slice of data
 */
function paginate<T>(data: T[], page: number): { slice: T[]; hasMore: boolean } {
  const start = (page - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  return {
    slice: data.slice(start, end),
    hasMore: end < data.length,
  }
}

/**
 * Create all AI tools bound to a specific profile (or all profiles for family view)
 */
export function createTools(context: ToolContext) {
  const { profileId, userId, provider, model, apiKey } = context
  // Convert null to undefined for service functions (undefined = all profiles)
  const profileIdForQuery = profileId ?? undefined

  return {
    // ═══════════════════════════════════════════════════════════════════════
    // DATA TOOLS - Return CSV data with pagination
    // ═══════════════════════════════════════════════════════════════════════

    getTransactions: tool({
      description: `Get transactions with optional filters. Returns data in CSV format.

**Pagination**: Returns up to 250 rows per page. To get more data:
- First call: omit queryId and page (or page=1)
- Next pages: pass the returned queryId with page=2, page=3, etc.

**Filters** (all optional):
- startDate/endDate: ISO dates (YYYY-MM-DD)
- category: Transaction category
- type: 'credit' | 'debit'
- minAmount/maxAmount: Amount range
- search: Search in description
- accountId: Specific account
- isSubscription: Only recurring`,
      inputSchema: z.object({
        // Pagination
        queryId: z.string().optional().describe('Query ID from previous call to fetch next page'),
        page: z.number().optional().default(1).describe('Page number (1-indexed)'),
        // Filters (only used on first call, ignored when queryId is provided)
        startDate: z.string().nullable().optional().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().nullable().optional().describe('End date (YYYY-MM-DD)'),
        category: z.string().nullable().optional().describe('Transaction category'),
        type: z.enum(['credit', 'debit']).nullable().optional().describe('Transaction type'),
        minAmount: z.number().nullable().optional().describe('Minimum amount'),
        maxAmount: z.number().nullable().optional().describe('Maximum amount'),
        search: z.string().nullable().optional().describe('Search in description'),
        accountId: z.string().nullable().optional().describe('Filter by account ID'),
        isSubscription: z.boolean().nullable().optional().describe('Only subscriptions'),
      }),
      execute: async (params) => {
        const page = params.page || 1

        // If queryId provided, fetch from cache and return requested page
        if (params.queryId) {
          const cached = await getQueryCache(params.queryId)
          if (!cached) {
            return { error: `Query ${params.queryId} not found. Run a new query.` }
          }
          if (cached.profileId !== profileId) {
            return { error: `Query ${params.queryId} does not belong to this profile.` }
          }

          const { slice, hasMore } = paginate(cached.data as Record<string, unknown>[], page)
          const csvData = toCSV(slice, [
            'date',
            'type',
            'amount',
            'category',
            'summary',
            'originalDescription',
          ])

          return {
            queryId: params.queryId,
            totalCount: cached.count,
            page,
            hasMore,
            rowsInPage: slice.length,
            data: csvData,
          }
        }

        // New query - fetch all data and cache it
        const filters: TransactionFilters = {
          profileId: profileIdForQuery,
          startDate: params.startDate ?? undefined,
          endDate: params.endDate ?? undefined,
          category: params.category ?? undefined,
          type: params.type ?? undefined,
          minAmount: params.minAmount ?? undefined,
          maxAmount: params.maxAmount ?? undefined,
          search: params.search ?? undefined,
          accountId: params.accountId ?? undefined,
          isSubscription: params.isSubscription ?? undefined,
        }

        // Fetch all matching transactions (up to a reasonable limit)
        const { transactions, total } = await getTransactions(userId, filters, { limit: 10000 })

        // Store in cache
        const queryId = generateQueryId('txn')
        await storeQueryCache({
          queryId,
          profileId,
          dataType: 'transactions',
          filters: filters as unknown as Record<string, unknown>,
          data: transactions,
          schema: buildTransactionSchema(),
        })

        // Return first page
        const { slice, hasMore } = paginate(transactions, page)
        const csvData = toCSV(
          slice.map((t) => ({
            date: t.date,
            type: t.type,
            amount: t.amount,
            category: t.category,
            summary: t.summary || '',
            originalDescription: t.originalDescription,
          })),
          ['date', 'type', 'amount', 'category', 'summary', 'originalDescription']
        )

        return {
          queryId,
          totalCount: total,
          page,
          hasMore,
          rowsInPage: slice.length,
          data: csvData,
        }
      },
    }),

    getAccounts: tool({
      description: `Get all bank accounts and credit cards with current balances.
Returns data in CSV format with pagination support.`,
      inputSchema: z.object({
        queryId: z.string().optional().describe('Query ID from previous call to fetch next page'),
        page: z.number().optional().default(1).describe('Page number (1-indexed)'),
      }),
      execute: async (params) => {
        const page = params.page || 1

        // If queryId provided, fetch from cache
        if (params.queryId) {
          const cached = await getQueryCache(params.queryId)
          if (!cached) {
            return { error: `Query ${params.queryId} not found. Run a new query.` }
          }
          if (cached.profileId !== profileId) {
            return { error: `Query ${params.queryId} does not belong to this profile.` }
          }

          const { slice, hasMore } = paginate(cached.data as Record<string, unknown>[], page)
          const csvData = toCSV(slice, [
            'id',
            'accountName',
            'type',
            'institution',
            'productName',
            'currency',
            'latestBalance',
            'isActive',
          ])

          return {
            queryId: params.queryId,
            totalCount: cached.count,
            page,
            hasMore,
            rowsInPage: slice.length,
            data: csvData,
          }
        }

        // New query
        const accounts = await getAccountsWithBalances(userId, profileIdForQuery)

        const queryId = generateQueryId('acc')
        await storeQueryCache({
          queryId,
          profileId,
          dataType: 'accounts',
          filters: {},
          data: accounts,
          schema: buildAccountsSchema(),
        })

        const { slice, hasMore } = paginate(accounts, page)
        const csvData = toCSV(
          slice.map((a) => ({
            id: a.id,
            accountName: a.accountName || '',
            type: a.type,
            institution: a.institution || '',
            productName: a.productName || '',
            currency: a.currency,
            latestBalance: a.latestBalance ?? '',
            isActive: a.isActive,
          })),
          [
            'id',
            'accountName',
            'type',
            'institution',
            'productName',
            'currency',
            'latestBalance',
            'isActive',
          ]
        )

        return {
          queryId,
          totalCount: accounts.length,
          page,
          hasMore,
          rowsInPage: slice.length,
          data: csvData,
        }
      },
    }),

    getHoldings: tool({
      description: `Get investment holdings (stocks, mutual funds, ETFs, etc.).
Returns data in CSV format with pagination support.

Use this to analyze the investment portfolio, identify holdings to buy/sell, etc.`,
      inputSchema: z.object({
        queryId: z.string().optional().describe('Query ID from previous call to fetch next page'),
        page: z.number().optional().default(1).describe('Page number (1-indexed)'),
        // Filters for new queries
        investmentType: z
          .string()
          .optional()
          .describe('Filter by type: stock, mutual_fund, etf, etc.'),
        sourceId: z.string().optional().describe('Filter by investment source/platform'),
      }),
      execute: async (params) => {
        const page = params.page || 1

        // If queryId provided, fetch from cache
        if (params.queryId) {
          const cached = await getQueryCache(params.queryId)
          if (!cached) {
            return { error: `Query ${params.queryId} not found. Run a new query.` }
          }
          if (cached.profileId !== profileId) {
            return { error: `Query ${params.queryId} does not belong to this profile.` }
          }

          const { slice, hasMore } = paginate(cached.data as Record<string, unknown>[], page)
          const csvData = toCSV(slice, [
            'name',
            'symbol',
            'investmentType',
            'units',
            'averageCost',
            'currentPrice',
            'currentValue',
            'investedValue',
            'gainLoss',
            'gainLossPercent',
            'currency',
          ])

          return {
            queryId: params.queryId,
            totalCount: cached.count,
            page,
            hasMore,
            rowsInPage: slice.length,
            data: csvData,
          }
        }

        // New query - fetch all then filter in memory if investmentType specified
        let holdings = await getHoldingsByUserId(userId, {
          profileId: profileIdForQuery,
          sourceId: params.sourceId,
        })

        // Filter by investment type if specified
        if (params.investmentType) {
          holdings = holdings.filter((h) => h.investmentType === params.investmentType)
        }

        const queryId = generateQueryId('hld')
        await storeQueryCache({
          queryId,
          profileId,
          dataType: 'holdings',
          filters: { investmentType: params.investmentType, sourceId: params.sourceId },
          data: holdings,
          schema: buildHoldingsSchema(),
        })

        const { slice, hasMore } = paginate(holdings, page)
        const csvData = toCSV(
          slice.map((h) => ({
            name: h.name,
            symbol: h.symbol || '',
            investmentType: h.investmentType,
            units: h.units ?? '',
            averageCost: h.averageCost ?? '',
            currentPrice: h.currentPrice ?? '',
            currentValue: h.currentValue,
            investedValue: h.investedValue ?? '',
            gainLoss: h.gainLoss ?? '',
            gainLossPercent: h.gainLossPercent ?? '',
            currency: h.currency,
          })),
          [
            'name',
            'symbol',
            'investmentType',
            'units',
            'averageCost',
            'currentPrice',
            'currentValue',
            'investedValue',
            'gainLoss',
            'gainLossPercent',
            'currency',
          ]
        )

        return {
          queryId,
          totalCount: holdings.length,
          page,
          hasMore,
          rowsInPage: slice.length,
          data: csvData,
        }
      },
    }),

    getInvestmentSources: tool({
      description: `Get investment sources/platforms (Zerodha, Groww, MF Central, etc.).
Returns data in CSV format.`,
      inputSchema: z.object({
        queryId: z.string().optional().describe('Query ID from previous call to fetch next page'),
        page: z.number().optional().default(1).describe('Page number (1-indexed)'),
      }),
      execute: async (params) => {
        const page = params.page || 1

        if (params.queryId) {
          const cached = await getQueryCache(params.queryId)
          if (!cached) {
            return { error: `Query ${params.queryId} not found. Run a new query.` }
          }
          if (cached.profileId !== profileId) {
            return { error: `Query ${params.queryId} does not belong to this profile.` }
          }

          const { slice, hasMore } = paginate(cached.data as Record<string, unknown>[], page)
          const csvData = toCSV(slice, [
            'id',
            'sourceName',
            'sourceType',
            'institution',
            'currency',
            'lastStatementDate',
          ])

          return {
            queryId: params.queryId,
            totalCount: cached.count,
            page,
            hasMore,
            rowsInPage: slice.length,
            data: csvData,
          }
        }

        const sources = await getSourcesByUserId(userId, profileIdForQuery)

        const queryId = generateQueryId('src')
        await storeQueryCache({
          queryId,
          profileId,
          dataType: 'accounts', // reusing accounts type
          filters: {},
          data: sources,
          schema: buildAccountsSchema(),
        })

        const { slice, hasMore } = paginate(sources, page)
        const csvData = toCSV(
          slice.map((s) => ({
            id: s.id,
            sourceName: s.sourceName,
            sourceType: s.sourceType,
            institution: s.institution || '',
            currency: s.currency,
            lastStatementDate: s.lastStatementDate || '',
          })),
          ['id', 'sourceName', 'sourceType', 'institution', 'currency', 'lastStatementDate']
        )

        return {
          queryId,
          totalCount: sources.length,
          page,
          hasMore,
          rowsInPage: slice.length,
          data: csvData,
        }
      },
    }),

    getSubscriptions: tool({
      description: `Get detected recurring subscriptions.
Returns data in CSV format.`,
      inputSchema: z.object({
        queryId: z.string().optional().describe('Query ID from previous call to fetch next page'),
        page: z.number().optional().default(1).describe('Page number (1-indexed)'),
      }),
      execute: async (params) => {
        const page = params.page || 1

        if (params.queryId) {
          const cached = await getQueryCache(params.queryId)
          if (!cached) {
            return { error: `Query ${params.queryId} not found. Run a new query.` }
          }
          if (cached.profileId !== profileId) {
            return { error: `Query ${params.queryId} does not belong to this profile.` }
          }

          const { slice, hasMore } = paginate(cached.data as Record<string, unknown>[], page)
          const csvData = toCSV(slice, [
            'name',
            'amount',
            'frequency',
            'category',
            'lastChargeDate',
            'chargeCount',
          ])

          return {
            queryId: params.queryId,
            totalCount: cached.count,
            page,
            hasMore,
            rowsInPage: slice.length,
            data: csvData,
          }
        }

        const result = await getDetectedSubscriptions(userId, profileIdForQuery)

        const queryId = generateQueryId('sub')
        await storeQueryCache({
          queryId,
          profileId,
          dataType: 'subscriptions',
          filters: {},
          data: result.subscriptions,
          schema: {
            fields: [
              { name: 'name', type: 'string' },
              { name: 'amount', type: 'number' },
              { name: 'frequency', type: 'string' },
              { name: 'category', type: 'string' },
              { name: 'lastChargeDate', type: 'date' },
              { name: 'chargeCount', type: 'number' },
            ],
          },
        })

        const { slice, hasMore } = paginate(result.subscriptions, page)
        const csvData = toCSV(
          slice.map((s) => ({
            name: s.name,
            amount: s.amount,
            frequency: s.frequency,
            category: s.category,
            lastChargeDate: s.lastChargeDate,
            chargeCount: s.chargeCount,
          })),
          ['name', 'amount', 'frequency', 'category', 'lastChargeDate', 'chargeCount']
        )

        return {
          queryId,
          totalCount: result.subscriptions.length,
          page,
          hasMore,
          rowsInPage: slice.length,
          data: csvData,
        }
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY/STATS TOOLS - Return aggregated data (no pagination needed)
    // ═══════════════════════════════════════════════════════════════════════

    getNetWorth: tool({
      description:
        'Get net worth = total assets (cash + investments) minus total liabilities. Returns the true net worth with breakdown by asset type.',
      inputSchema: z.object({}),
      execute: async () => {
        const [accountData, investments] = await Promise.all([
          calculateNetWorth(userId, profileIdForQuery),
          getInvestmentSummary(userId, profileIdForQuery),
        ])

        // True net worth: (cash + investments) - liabilities
        const totalAssets = accountData.totalAssets + investments.totalCurrent
        const totalNetWorth = totalAssets - accountData.totalLiabilities

        return {
          // Net worth summary
          total: totalNetWorth,
          totalAssets,
          totalLiabilities: accountData.totalLiabilities,
          currency: accountData.currency,

          // Breakdown by asset/liability type
          breakdown: {
            cash: {
              total: accountData.totalAssets,
              accountCount: accountData.accounts.filter((a) => !a.isLiability).length,
            },
            investments: {
              total: investments.totalCurrent,
              info: 'Call getInvestmentSummary for detailed breakdown by source',
            },
            liabilities: {
              total: accountData.totalLiabilities,
              accountCount: accountData.accounts.filter((a) => a.isLiability).length,
            },
          },

          calculatedAt: accountData.calculatedAt,
        }
      },
    }),

    getInvestmentSummary: tool({
      description:
        'Get investment portfolio breakdown by source (e.g., Zerodha, Groww, EPF, PPF). Use this to see detailed investment allocation and performance.',
      inputSchema: z.object({}),
      execute: async () => {
        const [holdings, sources] = await Promise.all([
          getHoldingsByUserId(userId, { profileId: profileIdForQuery }),
          getSourcesByUserId(userId, profileIdForQuery),
        ])

        // Build source name lookup
        const sourceNameMap = new Map<string, string>()
        for (const source of sources) {
          sourceNameMap.set(source.id, source.sourceName)
        }

        // Group holdings by source
        const sourceMap = new Map<
          string,
          {
            sourceName: string
            current: number
            invested: number
            holdingsCount: number
          }
        >()
        let totalCurrent = 0

        for (const h of holdings) {
          const current = h.currentValue ?? 0
          const invested = h.investedValue ?? 0
          totalCurrent += current

          const sourceId = h.sourceId || 'unknown'
          const sourceName = h.sourceId ? sourceNameMap.get(h.sourceId) || 'Unknown' : 'Manual'

          const sourceData = sourceMap.get(sourceId) || {
            sourceName,
            current: 0,
            invested: 0,
            holdingsCount: 0,
          }
          sourceData.current += current
          sourceData.invested += invested
          sourceData.holdingsCount++
          sourceMap.set(sourceId, sourceData)
        }

        return {
          total: totalCurrent,
          currency: 'INR',
          bySource: Array.from(sourceMap.values())
            .map(({ sourceName, current, invested, holdingsCount }) => {
              const gainLoss = current - invested
              const percent = invested > 0 ? (gainLoss / invested) * 100 : 0
              return {
                source: sourceName,
                current,
                invested,
                gainLoss,
                gainLossPercent: Math.round(percent * 100) / 100,
                holdingsCount,
              }
            })
            .sort((a, b) => b.current - a.current),
        }
      },
    }),

    getCategoryBreakdown: tool({
      description: `Get credits and debits breakdown by category for a period. Use this to analyze spending patterns, income sources, and calculate savings.

**Returns per category:**
- credits: Total money received (inflow)
- debits: Total money spent (outflow)
- creditCount/debitCount: Number of transactions
- net: credits - debits (positive = net inflow, negative = net outflow)

**Also returns totals** across all categories.

Use this data to identify income categories, expense categories, and calculate metrics like savings rate.`,
      inputSchema: z.object({
        startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      }),
      execute: async (params) => {
        return await getCategoryBreakdown(userId, {
          profileId: profileIdForQuery,
          startDate: params.startDate,
          endDate: params.endDate,
        })
      },
    }),

    getMonthlyTrends: tool({
      description: 'Get monthly income and expense trends.',
      inputSchema: z.object({
        months: z.number().optional().default(12).describe('Number of months (default: 12)'),
      }),
      execute: async (params) => {
        const months = Math.min(params.months || 12, 24)
        const result = await getMonthlyTrends(userId, profileIdForQuery, { months })

        return {
          currency: result.currency,
          trends: result.trends,
        }
      },
    }),

    getInsurancePolicies: tool({
      description: `Get insurance policies with coverage, premium, and renewal information.
Returns life insurance, health insurance, and vehicle insurance details.

**Pagination**: Returns up to 250 rows per page.
- First call: omit queryId and page (or page=1)
- Next pages: pass the returned queryId with page=2, page=3, etc.

**Data includes**: id, policy type, provider, policy number, sum insured, premium, start/end dates, status.

**For detailed policy info**: Use getInsurancePolicyDetails with the policy id to get full document text for specific questions about terms, exclusions, or claim process.`,
      inputSchema: z.object({
        queryId: z.string().optional().describe('Query ID from previous call to fetch next page'),
        page: z.number().optional().default(1).describe('Page number (1-indexed)'),
        policyType: z
          .enum(['life_insurance', 'health_insurance', 'vehicle_insurance'])
          .optional()
          .describe('Filter by policy type'),
        status: z.enum(['active', 'expired', 'cancelled']).optional().describe('Filter by status'),
      }),
      execute: async (params) => {
        const page = params.page || 1

        // If queryId provided, fetch from cache
        if (params.queryId) {
          const cached = await getQueryCache(params.queryId)
          if (!cached) {
            return { error: `Query ${params.queryId} not found. Run a new query.` }
          }
          if (cached.profileId !== profileId) {
            return { error: `Query ${params.queryId} does not belong to this profile.` }
          }

          const { slice, hasMore } = paginate(cached.data as Record<string, unknown>[], page)
          const csvData = toCSV(slice, [
            'id',
            'policyType',
            'provider',
            'policyNumber',
            'policyHolderName',
            'sumInsured',
            'premiumAmount',
            'premiumFrequency',
            'startDate',
            'endDate',
            'status',
            'profileName',
          ])

          return {
            queryId: params.queryId,
            totalCount: cached.count,
            page,
            hasMore,
            rowsInPage: slice.length,
            data: csvData,
          }
        }

        // New query
        const filters: PolicyFilters = {}
        if (params.policyType) filters.policyType = params.policyType
        if (params.status) filters.status = params.status

        const policies = await getPoliciesByUser(userId, filters)

        const queryId = generateQueryId('ins')
        await storeQueryCache({
          queryId,
          profileId,
          dataType: 'insurance_policies',
          filters,
          data: policies,
          schema: {
            fields: [
              { name: 'id', type: 'string' },
              { name: 'policyType', type: 'string' },
              { name: 'provider', type: 'string' },
              { name: 'policyNumber', type: 'string' },
              { name: 'policyHolderName', type: 'string' },
              { name: 'sumInsured', type: 'number' },
              { name: 'premiumAmount', type: 'number' },
              { name: 'premiumFrequency', type: 'string' },
              { name: 'startDate', type: 'date' },
              { name: 'endDate', type: 'date' },
              { name: 'status', type: 'string' },
              { name: 'profileName', type: 'string' },
            ],
          },
        })

        const { slice, hasMore } = paginate(policies, page)
        const csvData = toCSV(
          slice.map((p) => ({
            id: p.id,
            policyType: p.policyType,
            provider: p.provider,
            policyNumber: p.policyNumber || '',
            policyHolderName: p.policyHolderName || '',
            sumInsured: p.sumInsured || 0,
            premiumAmount: p.premiumAmount || 0,
            premiumFrequency: p.premiumFrequency || '',
            startDate: p.startDate || '',
            endDate: p.endDate || '',
            status: p.status,
            profileName: p.profileName || '',
          })),
          [
            'id',
            'policyType',
            'provider',
            'policyNumber',
            'policyHolderName',
            'sumInsured',
            'premiumAmount',
            'premiumFrequency',
            'startDate',
            'endDate',
            'status',
            'profileName',
          ]
        )

        return {
          queryId,
          totalCount: policies.length,
          page,
          hasMore,
          rowsInPage: slice.length,
          data: csvData,
        }
      },
    }),

    getInsurancePolicyDetails: tool({
      description: `Get detailed information about a specific insurance policy, including the full document text.
Use this when the user asks specific questions about policy terms, exclusions, claim process, or any detailed information that requires the original document text.

**Returns**: Policy metadata plus full raw text extracted from the PDF.`,
      inputSchema: z.object({
        policyId: z.string().describe('The policy ID to retrieve details for'),
      }),
      execute: async (params) => {
        const policy = await getPolicyById(params.policyId, userId)

        if (!policy) {
          return { error: `Policy ${params.policyId} not found.` }
        }

        return {
          id: policy.id,
          policyType: policy.policyType,
          provider: policy.provider,
          policyNumber: policy.policyNumber,
          policyHolderName: policy.policyHolderName,
          sumInsured: policy.sumInsured,
          premiumAmount: policy.premiumAmount,
          premiumFrequency: policy.premiumFrequency,
          startDate: policy.startDate,
          endDate: policy.endDate,
          status: policy.status,
          details: policy.details,
          rawText: policy.rawText || 'Raw text not available for this policy.',
        }
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // CODE EXECUTION TOOL (E2B)
    // ═══════════════════════════════════════════════════════════════════════

    executeCode: tool({
      description: `Execute Python code in a sandboxed environment for custom analysis or charts.

**IMPORTANT**: First call a data tool (getTransactions, getHoldings, etc.) to get a queryId.

**Available variables** (auto-injected based on queryIds):
- data_<queryId>: List of dicts with full data
- df_<queryId>: Pandas DataFrame

**Your code MUST set a 'result' variable.**

**Output formats:**
- chart: { "type": "bar|line|pie|area", "data": [...], "config": {"xKey", "yKey", "title"} }
- table: { "columns": [...], "rows": [...] }
- value: any JSON-serializable value`,
      inputSchema: z.object({
        code: z.string().describe('Python code to execute (must set result variable)'),
        queryIds: z.array(z.string()).describe('Query IDs from previous tool calls'),
        outputType: z.enum(['chart', 'table', 'value']).describe('Expected output format'),
      }),
      execute: async (params) => {
        if (!isE2BConfigured()) {
          return {
            error: 'Code execution is not available. E2B_API_KEY is not configured.',
          }
        }

        // Validate query IDs
        for (const queryId of params.queryIds) {
          const cached = await getQueryCache(queryId)
          if (!cached) {
            return {
              error: `Query ${queryId} not found. Run a data tool first.`,
            }
          }
          if (cached.profileId !== profileId) {
            return {
              error: `Query ${queryId} does not belong to this profile.`,
            }
          }
        }

        const result = await runCodeInSandbox({
          code: params.code,
          queryIds: params.queryIds,
          profileId,
          outputType: params.outputType,
        })

        if (!result.success) {
          return {
            error: result.error,
            logs: result.logs,
          }
        }

        switch (result.outputType) {
          case 'chart':
            return { success: true, outputType: 'chart', chart: result.chart }
          case 'table':
            return { success: true, outputType: 'table', table: result.table }
          default:
            return { success: true, outputType: 'value', value: result.value }
        }
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // WEB SEARCH TOOL - Wrapper approach
    // Uses generateText internally to call native search tools
    // This avoids the "cannot mix provider tools with custom tools" limitation
    // ═══════════════════════════════════════════════════════════════════════

    ...createWebSearchTools({ provider, model, apiKey }),
  }
}

/**
 * Create web search tools using the wrapper approach
 * This creates a custom tool that internally calls generateText with native search tools
 * Works around the "cannot mix provider tools with custom tools" limitation
 */
function createWebSearchTools(context: {
  provider: AIProvider
  model: string
  apiKey?: string
}): Record<string, unknown> {
  const { provider, model, apiKey } = context
  const searchType = getSearchType(provider)
  if (!searchType) return {}

  return {
    webSearch: tool({
      description: `Search the web for current information.
Use for: market data, stock prices, financial news, company info, general knowledge.
Returns search results with relevant content from the web.`,
      inputSchema: z.object({
        query: z.string().describe('The search query - be specific for better results'),
      }),
      execute: async (params) => {
        logger.debug(`[WebSearch] Executing search`, {
          query: params.query,
          type: searchType,
          provider,
          model,
        })

        const result = await executeWebSearch(params.query, searchType, { provider, model, apiKey })

        if (result.error) {
          logger.error(`[WebSearch] Search error:`, result.error)
          return { error: result.error }
        }

        logger.debug(`[WebSearch] Search completed`, {
          resultsCount: result.results.length,
        })

        return {
          query: params.query,
          results: result.results,
        }
      },
    }),

    // Keep webExtract for Tavily users (it's useful for reading full page content)
    ...(searchType === 'tavily' && isTavilyConfigured()
      ? {
          webExtract: tool({
            description: `Extract content from URLs. Use to read full webpage content.`,
            inputSchema: z.object({
              urls: z.array(z.string().url()).min(1).max(5).describe('URLs to extract (max 5)'),
            }),
            execute: async (params) => {
              const client = getTavilyClient()
              if (!client) {
                return { error: 'Web extract not available. TAVILY_API_KEY not configured.' }
              }

              try {
                const response = await client.extract(params.urls, {
                  extractDepth: 'basic',
                  includeImages: false,
                })

                return {
                  results: response.results.map((r) => ({
                    url: r.url,
                    content: r.rawContent,
                  })),
                  failedUrls: response.failedResults || [],
                }
              } catch (error) {
                return {
                  error: `Web extract failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                }
              }
            },
          }),
        }
      : {}),
  }
}
