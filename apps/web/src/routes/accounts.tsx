import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { PageHeader } from '@/components/ui/page-header'
import { Building2, CreditCard, Upload } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import type { Account, Statement } from '@/lib/api'
import {
  useAuth,
  useAccounts,
  useAccountTypes,
  useDeleteAccount,
  useStatements,
  useConstants,
  useProfileSelection,
} from '@/hooks'
import { BankAccountCard, CreditCardDisplay, AccountForm } from '@/components/accounts'
import { RecategorizeModal } from '@/components/transactions/recategorize-modal'

export const Route = createFileRoute('/accounts')({
  component: AccountsPage,
})

function AccountsPage() {
  const queryClient = useQueryClient()
  const { user, profiles } = useAuth()
  const {
    activeProfileId,
    showFamilyView,
    selectorProfileId,
    handleProfileChange,
    handleFamilyViewChange,
  } = useProfileSelection()
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [recategorizeAccount, setRecategorizeAccount] = useState<Account | null>(null)
  const countryCode = user?.country?.toLowerCase() || 'in'

  // Query enabled when we have a profileId OR we're in family view
  const queryEnabled = !!activeProfileId || showFamilyView

  // Query hooks
  const { data: accounts, isLoading: accountsLoading } = useAccounts(activeProfileId, {
    enabled: queryEnabled,
  })
  const { data: accountTypes } = useAccountTypes()
  const { data: statements } = useStatements(activeProfileId, { enabled: queryEnabled })
  const { institutions } = useConstants()

  // Mutation hooks
  const deleteMutation = useDeleteAccount(activeProfileId)

  // Create map of accountId -> latest statement for quick lookup
  const statementsByAccount = new Map<string, Statement>()
  statements?.forEach((s) => {
    if (s.accountId) {
      const existing = statementsByAccount.get(s.accountId)
      if (!existing || new Date(s.createdAt) > new Date(existing.createdAt)) {
        statementsByAccount.set(s.accountId, s)
      }
    }
  })

  // Separate credit cards from bank accounts
  const creditCards = accounts?.filter((a) => a.type === 'credit_card') || []
  const bankAccounts = accounts?.filter((a) => a.type !== 'credit_card') || []

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <PageHeader
          title="Accounts"
          description="Manage your financial accounts"
          actions={
            <ProfileSelector
              selectedProfileId={selectorProfileId}
              onProfileChange={handleProfileChange}
              showFamilyView={showFamilyView}
              onFamilyViewChange={handleFamilyViewChange}
            />
          }
        />

        {/* Edit Form */}
        {editingAccount && (
          <AccountForm
            account={editingAccount}
            profileId={activeProfileId!}
            accountTypes={accountTypes || []}
            onClose={() => {
              setEditingAccount(null)
            }}
            onSuccess={() => {
              setEditingAccount(null)
              queryClient.invalidateQueries({ queryKey: ['accounts'] })
            }}
          />
        )}

        {/* Accounts Display */}
        {accountsLoading ? (
          <div className="space-y-8">
            <section>
              <div className="h-7 w-32 bg-surface-elevated rounded animate-pulse mb-4" />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            </section>
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className="space-y-8">
            {/* Credit Cards Section */}
            {creditCards.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Credit Cards
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {creditCards.map((account) => (
                    <CreditCardDisplay
                      key={account.id}
                      account={account}
                      countryCode={countryCode}
                      institutionName={
                        account.institution ? institutions[account.institution] : undefined
                      }
                      onEdit={() => setEditingAccount(account)}
                      onDelete={() => deleteMutation.mutate(account.id)}
                      onRecategorize={() => setRecategorizeAccount(account)}
                      profiles={profiles}
                      showProfileBadge={showFamilyView}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Bank Accounts Section */}
            {bankAccounts.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Bank Accounts
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {bankAccounts.map((account) => (
                    <BankAccountCard
                      key={account.id}
                      account={account}
                      accountTypes={accountTypes || []}
                      countryCode={countryCode}
                      institutionName={
                        account.institution ? institutions[account.institution] : undefined
                      }
                      statement={statementsByAccount.get(account.id)}
                      onEdit={() => setEditingAccount(account)}
                      onDelete={() => deleteMutation.mutate(account.id)}
                      onRecategorize={() => setRecategorizeAccount(account)}
                      profiles={profiles}
                      showProfileBadge={showFamilyView}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <EmptyState
            icon={Upload}
            title="No accounts yet"
            description="Upload a bank or credit card statement to automatically add your accounts and start tracking your finances."
            action={{
              label: 'Upload Statement',
              href: '/statements?upload=true',
              icon: Upload,
            }}
          />
        )}

        {/* Recategorize Modal */}
        {activeProfileId && recategorizeAccount && (
          <RecategorizeModal
            open={!!recategorizeAccount}
            onOpenChange={(open) => !open && setRecategorizeAccount(null)}
            profileId={activeProfileId}
            accountId={recategorizeAccount.id}
            targetName={
              recategorizeAccount.accountName || recategorizeAccount.institution || 'Account'
            }
            _targetType="account"
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['transactions'] })
            }}
          />
        )}
      </div>
    </AppLayout>
  )
}
