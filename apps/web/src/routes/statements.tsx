import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Upload } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/skeleton'
import {
  useProfiles,
  useAuthStatus,
  useStatements,
  useAccounts,
  useInvestmentSources,
  useConstants,
  useDeleteStatement,
} from '@/hooks'
import { StatementCard, FilterBar, UploadForm, type SortOption } from '@/components/statements'
import { RecategorizeModal } from '@/components/transactions/recategorize-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { FileText, Upload as UploadIcon } from 'lucide-react'
import type { Statement } from '@/lib/api'

// Search params validation
type StatementsSearchParams = {
  upload?: boolean
}

export const Route = createFileRoute('/statements')({
  component: StatementsPage,
  validateSearch: (search: Record<string, unknown>): StatementsSearchParams => {
    return {
      upload: search.upload === true || search.upload === 'true',
    }
  },
})

const SORT_STORAGE_KEY = 'statements_sort_order'

function StatementsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const searchParams = useSearch({ from: '/statements' })
  const { defaultProfile } = useProfiles()
  useAuthStatus()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOption>(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY)
    return (saved as SortOption) || 'period_desc'
  })
  const [recategorizeStatement, setRecategorizeStatement] = useState<Statement | null>(null)

  // Open upload dialog if ?upload=true is in the URL
  useEffect(() => {
    if (searchParams.upload) {
      // Use setTimeout to avoid sync setState in effect
      const timer = setTimeout(() => {
        setShowUploadDialog(true)
        // Clear the search param without navigating
        navigate({ to: '/statements', search: {}, replace: true })
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [searchParams.upload, navigate])

  const handleSortChange = (value: SortOption) => {
    setSortOrder(value)
    localStorage.setItem(SORT_STORAGE_KEY, value)
  }

  const activeProfileId = selectedProfileId || defaultProfile?.id

  // Query hooks
  const { data: statements, isLoading: statementsLoading } = useStatements(activeProfileId, {
    refetchInterval: (query) => {
      // Poll for updates when any statement is pending or parsing
      const data = (query as { state: { data?: { status: string }[] } }).state.data
      if (data?.some((s) => s.status === 'pending' || s.status === 'parsing')) {
        return 3000
      }
      return false
    },
  })
  const { data: accounts } = useAccounts(activeProfileId)
  const { data: investmentSources } = useInvestmentSources(activeProfileId)
  const { rawInvestmentSourceTypes, rawInstitutions } = useConstants()

  // Mutation hooks
  const deleteMutation = useDeleteStatement(activeProfileId)

  // Create lookup maps
  const accountMap = new Map(accounts?.map((a) => [a.id, a]) || [])
  const sourceMap = new Map(investmentSources?.map((s) => [s.id, s]) || [])
  const sourceTypeMap = new Map(rawInvestmentSourceTypes.map((st) => [st.code, st]))
  const institutionMap = new Map(rawInstitutions.map((inst) => [inst.id, inst]))

  // Filter and sort statements
  const filteredAndSortedStatements = (() => {
    const result = accountFilter
      ? statements?.filter((s) => s.accountId === accountFilter)
      : statements

    if (!result) return result

    return [...result].sort((a, b) => {
      switch (sortOrder) {
        case 'period_desc': {
          const dateA = a.periodEnd || a.periodStart || a.createdAt
          const dateB = b.periodEnd || b.periodStart || b.createdAt
          return new Date(dateB).getTime() - new Date(dateA).getTime()
        }
        case 'period_asc': {
          const dateA = a.periodStart || a.periodEnd || a.createdAt
          const dateB = b.periodStart || b.periodEnd || b.createdAt
          return new Date(dateA).getTime() - new Date(dateB).getTime()
        }
        case 'upload_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'upload_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        default:
          return 0
      }
    })
  })()

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatPeriod = (start: string | null, end: string | null) => {
    if (!start && !end) return null
    const formatFull = (d: string) =>
      new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    if (start && end) return `${formatFull(start)} – ${formatFull(end)}`
    if (end) return formatFull(end)
    return formatFull(start!)
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Statements"
          description="Upload and manage your financial statements"
          actions={
            <>
              <ProfileSelector
                selectedProfileId={activeProfileId || null}
                onProfileChange={(profile) => setSelectedProfileId(profile.id)}
              />
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Statement
              </Button>
            </>
          }
        />

        {/* Filter & Sort Bar */}
        {accounts && (
          <FilterBar
            accounts={accounts}
            accountFilter={accountFilter}
            sortOrder={sortOrder}
            statementsCount={filteredAndSortedStatements?.length || 0}
            onAccountFilterChange={setAccountFilter}
            onSortChange={handleSortChange}
          />
        )}

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent
            className="sm:max-w-2xl p-0 gap-0 h-150 max-h-[85vh] flex flex-col"
            showCloseButton={false}
          >
            {activeProfileId && (
              <UploadForm
                profileId={activeProfileId}
                onClose={() => setShowUploadDialog(false)}
                onSuccess={() => {
                  setShowUploadDialog(false)
                  queryClient.invalidateQueries({ queryKey: ['statements'] })
                  queryClient.invalidateQueries({ queryKey: ['accounts'] })
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Statements Grid */}
        {statementsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filteredAndSortedStatements && filteredAndSortedStatements.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedStatements.map((statement) => {
              const account = statement.accountId ? accountMap.get(statement.accountId) : undefined
              const source = statement.sourceId ? sourceMap.get(statement.sourceId) : undefined
              const isInvestment = statement.documentType === 'investment_statement'

              // For investment statements, use the sourceType logo from constants
              // For bank/credit card statements, use the institution logo from constants
              let logoPath: string | null = null
              if (isInvestment && source?.sourceType) {
                const sourceType = sourceTypeMap.get(source.sourceType)
                logoPath = sourceType?.logo || null
              } else if (!isInvestment && account?.institution) {
                const institution = institutionMap.get(account.institution)
                logoPath = institution?.logo || null
              }

              return (
                <StatementCard
                  key={statement.id}
                  statement={statement}
                  account={account}
                  source={source}
                  logoPath={logoPath}
                  formatFileSize={formatFileSize}
                  formatPeriod={formatPeriod}
                  onDelete={() => deleteMutation.mutate(statement.id)}
                  onRecategorize={() => setRecategorizeStatement(statement)}
                />
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={accountFilter ? FileText : UploadIcon}
            title={accountFilter ? 'No statements for this account' : 'No statements yet'}
            description={
              accountFilter
                ? 'Upload a statement for this account or clear the filter to see all statements.'
                : 'Upload a bank, credit card, or investment statement to start tracking your finances.'
            }
            action={{
              label: 'Upload Statement',
              onClick: () => setShowUploadDialog(true),
              icon: UploadIcon,
            }}
          />
        )}

        {/* Recategorize Modal */}
        {activeProfileId && recategorizeStatement && (
          <RecategorizeModal
            open={!!recategorizeStatement}
            onOpenChange={(open) => !open && setRecategorizeStatement(null)}
            profileId={activeProfileId}
            statementId={recategorizeStatement.id}
            targetName={recategorizeStatement.originalFilename || 'Statement'}
            targetType="statement"
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['transactions'] })
            }}
          />
        )}
      </div>
    </AppLayout>
  )
}
