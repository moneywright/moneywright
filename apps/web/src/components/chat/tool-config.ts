/**
 * Tool configuration for icons and labels
 */

import {
  Search,
  Wallet,
  TrendingUp,
  Receipt,
  Building2,
  Repeat,
  Tag,
  Code2,
  Shield,
} from 'lucide-react'

// Tool config for icons and labels (pending = in progress, completed = done)
export const TOOL_CONFIG: Record<
  string,
  { icon: typeof Search; pending: string; completed: string }
> = {
  // Account tools
  getAccountSummary: {
    icon: Building2,
    pending: 'Fetching account summary',
    completed: 'Fetched account summary',
  },
  getAccounts: { icon: Building2, pending: 'Loading accounts', completed: 'Loaded accounts' },

  // Transaction tools
  getTransactions: {
    icon: Receipt,
    pending: 'Fetching transactions',
    completed: 'Fetched transactions',
  },
  queryTransactions: {
    icon: Receipt,
    pending: 'Searching transactions',
    completed: 'Found transactions',
  },
  getCategoryBreakdown: {
    icon: Tag,
    pending: 'Fetching category breakdown',
    completed: 'Fetched category breakdown',
  },
  getMonthlyTrends: {
    icon: TrendingUp,
    pending: 'Fetching monthly trends',
    completed: 'Fetched monthly trends',
  },

  // Investment tools
  getHoldings: { icon: TrendingUp, pending: 'Fetching holdings', completed: 'Fetched holdings' },
  getInvestmentSummary: {
    icon: TrendingUp,
    pending: 'Fetching investment data',
    completed: 'Fetched investment data',
  },
  getInvestmentSources: {
    icon: TrendingUp,
    pending: 'Loading investment sources',
    completed: 'Loaded investment sources',
  },

  // Subscription tools
  getSubscriptions: {
    icon: Repeat,
    pending: 'Finding subscriptions',
    completed: 'Found subscriptions',
  },

  // Net worth tools
  getNetWorth: {
    icon: Wallet,
    pending: 'Calculating net worth',
    completed: 'Calculated net worth',
  },

  // Insurance tools
  getInsurancePolicies: {
    icon: Shield,
    pending: 'Fetching insurance policies',
    completed: 'Fetched insurance policies',
  },
  getInsurancePolicyDetails: {
    icon: Shield,
    pending: 'Loading policy details',
    completed: 'Loaded policy details',
  },

  // Code execution
  executeCode: { icon: Code2, pending: 'Running analysis', completed: 'Completed analysis' },

  // Web tools (Tavily)
  webSearch: { icon: Search, pending: 'Searching the web', completed: 'Web search complete' },
  webExtract: { icon: Search, pending: 'Extracting content', completed: 'Content extracted' },
}
