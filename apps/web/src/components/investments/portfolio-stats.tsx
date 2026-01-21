import { TrendingUp, TrendingDown, Wallet, PiggyBank, Percent } from 'lucide-react'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'

interface PortfolioStatsProps {
  totalCurrent: number
  totalInvested: number
  totalGainLoss: number
  gainLossPercent: number | null
  currency: string
  isLoading?: boolean
}

export function PortfolioStats({
  totalCurrent,
  totalInvested,
  totalGainLoss,
  gainLossPercent,
  currency,
  isLoading,
}: PortfolioStatsProps) {
  const isPositive = totalGainLoss >= 0
  const hasValidReturns = gainLossPercent !== null && totalInvested > 0

  return (
    <StatCardGrid>
      {/* Portfolio Value */}
      <StatCard
        label="Portfolio Value"
        value={totalCurrent}
        currency={currency}
        icon={Wallet}
        loading={isLoading}
      />

      {/* Invested */}
      <StatCard
        label="Invested"
        value={totalInvested > 0 ? totalInvested : undefined}
        currency={currency}
        icon={PiggyBank}
        loading={isLoading}
      />

      {/* Total Gain/Loss */}
      <StatCard
        label="Total Gain"
        value={hasValidReturns ? totalGainLoss : undefined}
        currency={currency}
        icon={isPositive ? TrendingUp : TrendingDown}
        loading={isLoading}
        trend={hasValidReturns ? (isPositive ? 'up' : 'down') : undefined}
        prefix={hasValidReturns && totalGainLoss >= 0 ? '+' : undefined}
      />

      {/* Returns */}
      <StatCard
        label="Returns"
        value={hasValidReturns ? gainLossPercent! : undefined}
        icon={Percent}
        loading={isLoading}
        trend={hasValidReturns ? (isPositive ? 'up' : 'down') : undefined}
        suffix="%"
        isPercentage
      />
    </StatCardGrid>
  )
}
