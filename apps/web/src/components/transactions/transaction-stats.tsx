import { TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'

interface TransactionStatsProps {
  totalCredits: number
  totalDebits: number
  creditCount: number
  debitCount: number
  netAmount: number
  currency: string
  statsLabel: string
  isLoading?: boolean
  formatAmount?: (amount: number, currency: string) => string
}

export function TransactionStats({
  totalCredits,
  totalDebits,
  creditCount,
  debitCount,
  netAmount,
  currency,
  statsLabel,
  isLoading,
}: TransactionStatsProps) {
  const totalCount = creditCount + debitCount

  return (
    <StatCardGrid>
      {/* Total Credits */}
      <StatCard
        label="Credits"
        value={totalCredits}
        currency={currency}
        subtitle={`${creditCount.toLocaleString()} transactions`}
        icon={TrendingUp}
        loading={isLoading}
        trend="up"
      />

      {/* Total Debits */}
      <StatCard
        label="Debits"
        value={totalDebits}
        currency={currency}
        subtitle={`${debitCount.toLocaleString()} transactions`}
        icon={TrendingDown}
        loading={isLoading}
        trend="down"
      />

      {/* Net Amount */}
      <StatCard
        label="Net Amount"
        value={netAmount}
        currency={currency}
        subtitle={netAmount >= 0 ? 'Surplus' : 'Deficit'}
        icon={Wallet}
        loading={isLoading}
        trend={netAmount >= 0 ? 'up' : 'down'}
      />

      {/* Total Transactions */}
      <StatCard
        label="Total"
        value={totalCount}
        subtitle={statsLabel}
        icon={BarChart3}
        loading={isLoading}
        isCount
      />
    </StatCardGrid>
  )
}
