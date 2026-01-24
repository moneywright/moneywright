/**
 * Account Balances card component
 */

import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import { AccountBalanceCard } from './account-balance-card'
import type { FinancialSummary } from '@/lib/api'

interface AccountBalancesCardProps {
  accounts: FinancialSummary['netWorth']['accounts']
}

export function AccountBalancesCard({ accounts }: AccountBalancesCardProps) {
  if (!accounts || accounts.length === 0) {
    return null
  }

  return (
    <Card className="mb-6 border-border-subtle hover:border-border-hover transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Account Balances
          </CardTitle>
          <Link to="/accounts">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Manage accounts
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountBalanceCard key={account.accountId} account={account} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
