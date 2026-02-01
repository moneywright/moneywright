// Country codes
export type CountryCode = 'IN' | 'US'

// Money scale (1-5)
export type MoneyScale = 1 | 2 | 3 | 4 | 5

// User input configuration
export interface GeneratorConfig {
  country: CountryCode
  startDate: Date
  endDate: Date
  bankAccountCount: number
  creditCardCount: number
  scale: MoneyScale
  outputDir: string
}

// Bank/Institution
export interface Institution {
  id: string
  name: string
  type: 'bank' | 'insurance' | 'broker' | 'mf_rta' | 'government'
}

// Account holder info (randomly generated)
export interface AccountHolder {
  name: string
  email: string
  phone: string
  address: string
  pan?: string // India
  ssn?: string // US (last 4 digits only)
}

// Bank account
export interface BankAccount {
  id: string
  institution: Institution
  accountNumber: string
  accountType: 'savings' | 'checking' | 'current'
  ifsc?: string // India
  routingNumber?: string // US
  holder: AccountHolder
}

// Credit card
export interface CreditCard {
  id: string
  institution: Institution
  cardNumber: string // Masked
  cardType: 'visa' | 'mastercard' | 'rupay' | 'amex'
  cardVariant: string // Gold, Platinum, etc.
  creditLimit: number
  holder: AccountHolder
  linkedBankAccount: BankAccount // For payment tracking
}

// Transaction categories
export type TransactionCategory =
  | 'food_dining'
  | 'groceries'
  | 'shopping'
  | 'utilities'
  | 'mobile_internet'
  | 'phone_internet'
  | 'emi'
  | 'mortgage'
  | 'rent'
  | 'fuel'
  | 'gas'
  | 'entertainment'
  | 'travel'
  | 'healthcare'
  | 'personal_care'
  | 'gifts'
  | 'education'
  | 'insurance'
  | 'investment'
  | 'software'
  | 'transfer'
  | 'atm_withdrawal'
  | 'salary'
  | 'paycheck'
  | 'refund'
  | 'cashback'
  | 'tax'
  | 'government'
  | 'charity'
  | 'dividend'
  | 'interest'
  | 'credit_card_payment'
  | 'bank_charges'
  | 'forex'
  | 'subscription'
  | 'other'

// Merchant definition
export interface Merchant {
  name: string
  category: TransactionCategory
  minAmount: number
  maxAmount: number
  isRecurring?: boolean
  recurringDay?: number // Day of month for recurring
}

// Transaction
export interface Transaction {
  id: string
  date: Date
  description: string
  amount: number
  type: 'credit' | 'debit'
  category: TransactionCategory
  merchant?: string
  reference?: string
  balance?: number // Running balance for bank statements
}

// Insurance types
export type InsuranceType = 'term_life' | 'health' | 'car' | 'endowment'

// Insurance policy
export interface InsurancePolicy {
  id: string
  type: InsuranceType
  provider: Institution
  policyNumber: string
  holder: AccountHolder
  sumAssured: number
  premium: number
  premiumFrequency: 'monthly' | 'quarterly' | 'yearly'
  startDate: Date
  endDate: Date
  nominees?: string[]
}

// Loan types
export type LoanType = 'home' | 'car' | 'personal'

// Loan
export interface Loan {
  id: string
  type: LoanType
  lender: Institution
  loanNumber: string
  holder: AccountHolder
  principalAmount: number
  interestRate: number
  tenure: number // in months
  emi: number
  startDate: Date
  disbursementDate: Date
  linkedBankAccount: BankAccount // For EMI deduction
}

// Investment types (India)
export type InvestmentTypeIN =
  | 'stocks'
  | 'mutual_funds'
  | 'fixed_deposit'
  | 'ppf'
  | 'epf'
  | 'nps'
  | 'gold'

// Investment types (US)
export type InvestmentTypeUS =
  | 'stocks'
  | 'etf'
  | 'mutual_funds'
  | '401k'
  | 'ira'
  | 'cd'

// Stock holding
export interface StockHolding {
  symbol: string
  name: string
  quantity: number
  avgPrice: number
  currentPrice: number
  value: number
  gainLoss: number
  gainLossPercent: number
}

// Mutual fund holding
export interface MutualFundHolding {
  folioNumber: string
  schemeName: string
  schemeCode: string
  units: number
  nav: number
  value: number
  investedAmount: number
  gainLoss: number
  xirr?: number
}

// Fixed deposit
export interface FixedDeposit {
  fdNumber: string
  bank: Institution
  principal: number
  interestRate: number
  tenure: number // in months
  startDate: Date
  maturityDate: Date
  maturityAmount: number
  interestPayout: 'cumulative' | 'monthly' | 'quarterly'
}

// PPF account
export interface PPFAccount {
  accountNumber: string
  bank: Institution
  openingDate: Date
  balance: number
  yearlyContributions: { year: string; amount: number }[]
  interestEarned: number
}

// EPF account
export interface EPFAccount {
  uan: string
  memberId: string
  employer: string
  balance: number
  employeeContribution: number
  employerContribution: number
  interestEarned: number
}

// 401k account
export interface Account401k {
  accountNumber: string
  provider: string
  employer: string
  balance: number
  employeeContribution: number
  employerMatch: number
  vestedBalance: number
  holdings: { fundName: string; allocation: number; value: number }[]
}

// IRA account
export interface IRAAccount {
  accountNumber: string
  provider: Institution
  type: 'traditional' | 'roth'
  balance: number
  contributions: number
  holdings: StockHolding[]
}

// Subscription service
export interface Subscription {
  name: string
  amount: number
  billingDay: number
  category: TransactionCategory
}

// Credit card statement
export interface CreditCardStatement {
  card: CreditCard
  statementDate: Date
  dueDate: Date
  periodStart: Date
  periodEnd: Date
  previousBalance: number
  paymentsReceived: number
  newCharges: number
  totalDue: number
  minimumDue: number
  transactions: Transaction[]
}

// Bank statement
export interface BankStatement {
  account: BankAccount
  periodStart: Date
  periodEnd: Date
  openingBalance: number
  closingBalance: number
  totalCredits: number
  totalDebits: number
  transactions: Transaction[]
}

// Generated document info
export interface GeneratedDocument {
  type: 'bank_statement' | 'credit_card' | 'insurance' | 'loan' | 'investment'
  subtype?: string
  filename: string
  format: 'pdf' | 'xlsx'
  path: string
}

// Generation context - tracks all generated data for cross-referencing
export interface GenerationContext {
  config: GeneratorConfig
  holder: AccountHolder
  bankAccounts: BankAccount[]
  creditCards: CreditCard[]
  insurancePolicies: InsurancePolicy[]
  loans: Loan[]
  subscriptions: Subscription[]
  // Investment data
  stockHoldings?: StockHolding[]
  mfHoldings?: MutualFundHolding[]
  fixedDeposits?: FixedDeposit[]
  ppfAccount?: PPFAccount
  epfAccount?: EPFAccount
  npsBalance?: number
  account401k?: Account401k
  iraAccount?: IRAAccount
  // Generated transactions (for linking)
  bankTransactions: Map<string, Transaction[]> // accountId -> transactions
  ccTransactions: Map<string, Transaction[]> // cardId -> transactions
  // Tracking CC payments for bank statement deduction
  ccPayments: Map<string, { date: Date; amount: number }[]> // cardId -> payments
}
