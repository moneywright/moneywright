/**
 * Detected Subscriptions card component
 */

import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import { SubscriptionsList } from './subscriptions-list'
import type { Subscription } from '@/lib/api'

interface SubscriptionsCardProps {
  subscriptions: Subscription[]
  totalMonthly: number
  currency: string
  getCategoryLabel: (code: string) => string
  isLoading: boolean
  countryCode: string
}

export function SubscriptionsCard({
  subscriptions,
  totalMonthly,
  currency,
  getCategoryLabel,
  isLoading,
  countryCode,
}: SubscriptionsCardProps) {
  return (
    <Card className="border-border-subtle hover:border-border-hover transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Detected Subscriptions
          </CardTitle>
          {subscriptions.length > 0 && (
            <Link to="/subscriptions">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                View all
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <SubscriptionsList
          subscriptions={subscriptions}
          totalMonthly={totalMonthly}
          currency={currency}
          getCategoryLabel={getCategoryLabel}
          isLoading={isLoading}
          countryCode={countryCode}
        />
      </CardContent>
    </Card>
  )
}
