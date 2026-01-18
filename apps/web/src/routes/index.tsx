import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useProfiles } from '@/hooks/useAuthStatus'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, PieChart, Wallet, TrendingUp, CreditCard, Banknote } from 'lucide-react'
import type { Profile } from '@/lib/api'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { defaultProfile } = useProfiles()

  // Selected profile state - null means use default
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showFamilyView, setShowFamilyView] = useState(false)

  // Use selected profile or fall back to default
  const selectedProfile = selectedProfileId ? { id: selectedProfileId } : defaultProfile

  const handleProfileChange = (profile: Profile) => {
    setSelectedProfileId(profile.id)
    setShowFamilyView(false)
  }

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Your finances at a glance</p>
        </div>
        <ProfileSelector
          selectedProfileId={selectedProfile?.id || null}
          onProfileChange={handleProfileChange}
          showFamilyView={showFamilyView}
          onFamilyViewChange={setShowFamilyView}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatsCard
          title="TOTAL BALANCE"
          value="—"
          description="Across all accounts"
          icon={Banknote}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatsCard
          title="MONTHLY SPEND"
          value="—"
          description="This month"
          icon={CreditCard}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-500"
        />
        <StatsCard
          title="INVESTMENTS"
          value="—"
          description="Total portfolio"
          icon={TrendingUp}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatsCard
          title="ACCOUNTS"
          value="0"
          description="Connected accounts"
          icon={Wallet}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <CardDescription>Your latest activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No transactions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a statement to get started
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by Category</CardTitle>
            <CardDescription>This month's breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PieChart className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No data available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Categories will appear after importing transactions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Insights</CardTitle>
            <CardDescription>Personalized recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <span className="text-lg">✨</span>
              </div>
              <p className="text-sm text-muted-foreground">Coming soon</p>
              <p className="text-xs text-muted-foreground mt-1">AI-powered financial insights</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State CTA */}
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Get started with Moneywright</h3>
            <p className="text-muted-foreground mb-6">
              Upload your bank statements, credit card statements, or investment documents to unlock
              powerful financial insights and AI-powered analysis.
            </p>
            <Button disabled size="lg">
              <Upload className="mr-2 h-4 w-4" />
              Upload Your First Statement
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  )
}

interface StatsCardProps {
  title: string
  value: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
}

function StatsCard({ title, value, description, icon: Icon, iconBg, iconColor }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
