import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ProfileBadge } from '@/components/ui/profile-badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Wallet,
  Home,
  Car,
  GraduationCap,
  Briefcase,
  Coins,
  Upload,
  FileText,
  Trash2,
  MoreVertical,
  Loader2,
  AlertCircle,
  Lock,
  X,
  Check,
  FileUp,
  Clock,
  Calendar,
  User,
  BadgeCheck,
  Building2,
  Percent,
  TrendingUp,
  MapPin,
  Receipt,
  ChevronRight,
  Banknote,
  Target,
  TrendingDown,
  CircleDollarSign,
  CheckCircle2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Loan, LoanType, Profile } from '@/lib/api'
import {
  getLLMProviders,
  getPreferences,
  setPreference,
  PREFERENCE_KEYS,
  uploadLoan,
} from '@/lib/api'
import {
  useAuth,
  useAccounts,
  useLoans,
  useDeleteLoan,
  useProfileSelection,
  useLoanPaymentHistory,
  useLoanOutstanding,
  useConstants,
} from '@/hooks'
import { cn } from '@/lib/utils'
import { PROVIDER_LOGOS, getLogoInvertStyle } from '@/lib/provider-logos'
import { toast } from 'sonner'

export const Route = createFileRoute('/loans')({
  component: LoansPage,
})

const LOAN_TYPE_CONFIG: Record<
  LoanType,
  { icon: typeof Wallet; label: string; color: string; bgColor: string }
> = {
  personal_loan: {
    icon: Wallet,
    label: 'Personal Loans',
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
  },
  home_loan: {
    icon: Home,
    label: 'Home Loans',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  vehicle_loan: {
    icon: Car,
    label: 'Vehicle Loans',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  education_loan: {
    icon: GraduationCap,
    label: 'Education Loans',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  business_loan: {
    icon: Briefcase,
    label: 'Business Loans',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  gold_loan: {
    icon: Coins,
    label: 'Gold Loans',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
}

function LoansPage() {
  const { user, profiles } = useAuth()
  const queryClient = useQueryClient()
  const { countryCode, rawInstitutions, institutions } = useConstants()
  const {
    activeProfileId,
    showFamilyView,
    selectorProfileId,
    handleProfileChange,
    handleFamilyViewChange,
  } = useProfileSelection()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)

  // Query enabled when we have a profileId OR we're in family view
  const queryEnabled = !!activeProfileId || showFamilyView

  // Query hooks
  const { data: loans, isLoading } = useLoans(activeProfileId, {
    enabled: queryEnabled,
    refetchInterval: (query) => {
      // Poll if any loans are pending/parsing
      const data = query.state.data
      if (!data) return false
      const hasProcessing = data.some(
        (l) => l.parseStatus === 'pending' || l.parseStatus === 'parsing'
      )
      return hasProcessing ? 3000 : false
    },
  })
  const { data: accounts } = useAccounts(activeProfileId, { enabled: queryEnabled })

  // Mutation hooks
  const deleteMutation = useDeleteLoan(activeProfileId)

  // Separate processing loans from completed ones
  const processingLoans =
    loans?.filter((l) => l.parseStatus === 'pending' || l.parseStatus === 'parsing') || []

  const completedLoans =
    loans?.filter((l) => l.parseStatus === 'completed' || l.parseStatus === 'failed') || []

  // Group completed loans by type
  const loanGroups = {
    personal_loan: completedLoans.filter((l) => l.loanType === 'personal_loan'),
    home_loan: completedLoans.filter((l) => l.loanType === 'home_loan'),
    vehicle_loan: completedLoans.filter((l) => l.loanType === 'vehicle_loan'),
    education_loan: completedLoans.filter((l) => l.loanType === 'education_loan'),
    business_loan: completedLoans.filter((l) => l.loanType === 'business_loan'),
    gold_loan: completedLoans.filter((l) => l.loanType === 'gold_loan'),
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteMutation.mutateAsync(deleteId)
    setDeleteId(null)
  }

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['loans'] })
    setUploadOpen(false)
  }

  const currencySymbol = user?.country === 'US' ? '$' : user?.country === 'GB' ? '£' : '₹'

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <PageHeader
          title="Loans"
          description="Manage your loan documents"
          actions={
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button onClick={() => setUploadOpen(true)} disabled={showFamilyView}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Loan Document
                    </Button>
                  </span>
                </TooltipTrigger>
                {showFamilyView && (
                  <TooltipContent>Switch to a profile to upload a loan document</TooltipContent>
                )}
              </Tooltip>
              <ProfileSelector
                selectedProfileId={selectorProfileId}
                onProfileChange={handleProfileChange}
                showFamilyView={showFamilyView}
                onFamilyViewChange={handleFamilyViewChange}
              />
            </div>
          }
        />

        {/* Loans Display */}
        {isLoading ? (
          <div className="space-y-8">
            {Object.entries(LOAN_TYPE_CONFIG)
              .slice(0, 3)
              .map(([type]) => (
                <section key={type}>
                  <div className="h-7 w-40 bg-surface-elevated rounded animate-pulse mb-4" />
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <CardSkeleton key={i} />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        ) : loans && loans.length > 0 ? (
          <div className="space-y-8">
            {/* Processing Section */}
            {processingLoans.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span>Processing</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ({processingLoans.length})
                  </span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {processingLoans.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      currencySymbol={currencySymbol}
                      profiles={profiles}
                      showProfileBadge={showFamilyView}
                      onDelete={() => setDeleteId(loan.id)}
                      countryCode={countryCode}
                      institutions={rawInstitutions}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed loans by type */}
            {(Object.entries(loanGroups) as [LoanType, Loan[]][]).map(([type, typeLoans]) => {
              if (typeLoans.length === 0) return null
              const config = LOAN_TYPE_CONFIG[type]
              const Icon = config.icon

              return (
                <section key={type}>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Icon className={cn('h-5 w-5', config.color)} />
                    {config.label}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {typeLoans.map((loan) => (
                      <LoanCard
                        key={loan.id}
                        loan={loan}
                        currencySymbol={currencySymbol}
                        profiles={profiles}
                        showProfileBadge={showFamilyView}
                        onDelete={() => setDeleteId(loan.id)}
                        onSelect={() => setSelectedLoan(loan)}
                        countryCode={countryCode}
                        institutions={rawInstitutions}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No loan documents yet"
            description={
              showFamilyView
                ? 'Switch to a profile to upload loan documents.'
                : 'Upload your loan documents to keep track of EMIs, interest rates, and repayment schedules.'
            }
            action={
              showFamilyView
                ? undefined
                : {
                    label: 'Upload Loan Document',
                    onClick: () => setUploadOpen(true),
                    icon: Upload,
                  }
            }
          />
        )}

        {/* Upload Dialog */}
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          profileId={activeProfileId}
          onSuccess={handleUploadSuccess}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Loan</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this loan document? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Loan Detail Sheet */}
        <LoanDetailSheet
          loan={selectedLoan}
          onOpenChange={(open) => !open && setSelectedLoan(null)}
          currencySymbol={currencySymbol}
          countryCode={countryCode}
          institutions={rawInstitutions}
          accounts={accounts}
          institutionsMap={institutions}
        />
      </div>
    </AppLayout>
  )
}

// ============================================
// Loan Card Component
// ============================================

interface LoanCardProps {
  loan: Loan
  currencySymbol: string
  profiles?: Profile[]
  showProfileBadge: boolean
  onDelete: () => void
  onSelect?: () => void
  countryCode?: string
  institutions?: { id: string; name: string; logo: string }[]
}

function LoanCard({
  loan,
  currencySymbol,
  profiles,
  showProfileBadge,
  onDelete,
  onSelect,
  countryCode,
  institutions,
}: LoanCardProps) {
  const [logoError, setLogoError] = useState(false)
  const profile = profiles?.find((p) => p.id === loan.profileId)

  const isProcessing = loan.parseStatus === 'pending' || loan.parseStatus === 'parsing'
  const isFailed = loan.parseStatus === 'failed'

  const config = LOAN_TYPE_CONFIG[loan.loanType]
  const Icon = config?.icon || Wallet

  // Get institution logo path if available
  const institution = loan.institution ? institutions?.find((i) => i.id === loan.institution) : null
  const logoPath =
    loan.institution && countryCode
      ? `/institutions/${countryCode.toLowerCase()}/${loan.institution}.svg`
      : null

  // Format currency
  const formatAmount = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format end date
  const formatEndDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const isExpired = date < now

    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    })

    return {
      text: isExpired ? `ended ${formatted}` : `ends ${formatted}`,
      isExpired,
    }
  }

  const endDateInfo = formatEndDate(loan.endDate)

  // Mask account number - show last 4 digits
  const maskedAccountNumber = loan.loanAccountNumber
    ? `••••${loan.loanAccountNumber.slice(-4)}`
    : null

  // Processing card
  if (isProcessing) {
    return (
      <div
        className={cn(
          'relative rounded-xl p-5 border-2 border-dashed',
          'bg-warning-muted border-warning/30'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border bg-warning-muted border-warning/20">
            <Clock className="h-5 w-5 text-warning animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-warning">Processing Document</h3>
            <p className="text-xs text-muted-foreground truncate">
              {loan.originalFilename || 'Extracting details...'}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            This loan will be updated once parsing is complete.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-warning" />
          <span className="text-xs text-warning">
            {loan.parseStatus === 'parsing' ? 'Parsing...' : 'Awaiting processing...'}
          </span>
        </div>

        {showProfileBadge && profile && (
          <div className="mt-4 pt-3 border-t border-warning/20">
            <ProfileBadge name={profile.name} />
          </div>
        )}
      </div>
    )
  }

  // Failed card
  if (isFailed) {
    return (
      <div
        className={cn(
          'relative rounded-xl p-5 border-2 border-dashed',
          'bg-negative-muted border-negative/30'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border bg-negative-muted border-negative/20">
            <AlertCircle className="h-5 w-5 text-negative" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-negative">Parsing Failed</h3>
            <p className="text-xs text-muted-foreground truncate">
              {loan.originalFilename || 'Loan document'}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            {loan.errorMessage ||
              'Failed to parse the document. You can delete this and try uploading again.'}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <AlertCircle className="h-3 w-3 text-negative" />
          <span className="text-xs text-negative">Parsing failed</span>
        </div>

        {showProfileBadge && profile && (
          <div className="mt-4 pt-3 border-t border-negative/20">
            <ProfileBadge name={profile.name} />
          </div>
        )}
      </div>
    )
  }

  // Completed card
  return (
    <div
      className={cn(
        'relative rounded-xl p-5 border transition-colors cursor-pointer',
        'bg-card border-border-subtle hover:border-border-hover'
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border-subtle shrink-0">
            {logoPath && !logoError ? (
              <img
                src={logoPath}
                alt={institution?.name || loan.lender}
                className="h-6 w-6 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Icon className={cn('h-5 w-5', config?.color || 'text-primary')} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate text-sm">
                {institution?.name || loan.lender}
              </h3>
              {showProfileBadge && profile && <ProfileBadge name={profile.name} />}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {maskedAccountNumber && <span>{maskedAccountNumber}</span>}
              {!maskedAccountNumber && config?.label.replace('s', '')}
            </p>
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* EMI and Interest Rate info */}
      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        {loan.emiAmount && (
          <span>
            {currencySymbol}
            {formatAmount(loan.emiAmount)}/mo
          </span>
        )}
        {loan.interestRate && (
          <span className="flex items-center gap-1">
            <Percent className="h-3 w-3" />
            {loan.interestRate}%
          </span>
        )}
      </div>

      {/* Principal Amount */}
      <div className="mt-4 pt-4 border-t border-border-subtle">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Principal</p>
        <div className="flex items-baseline justify-between mt-1">
          <p className="text-xl font-semibold tabular-nums">
            {loan.principalAmount !== null
              ? `${currencySymbol}${formatAmount(loan.principalAmount)}`
              : '—'}
          </p>
          {endDateInfo && (
            <p
              className={cn(
                'text-xs',
                endDateInfo.isExpired ? 'text-positive' : 'text-muted-foreground'
              )}
            >
              {endDateInfo.isExpired ? 'closed' : endDateInfo.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Upload Dialog Component
// ============================================

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
  onSuccess: () => void
}

function UploadDialog({ open, onOpenChange, profileId, onSuccess }: UploadDialogProps) {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  const [password, setPassword] = useState('')
  const [showPasswordField, setShowPasswordField] = useState(false)
  const [parsingModelValue, setParsingModelValue] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: providers } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: getLLMProviders,
  })

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => getPreferences(),
  })

  // Save preference mutation
  const savePreferenceMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => setPreference(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
    },
  })

  // Get only configured providers
  const configuredProviders = useMemo(
    () => providers?.filter((p) => p.isConfigured) || [],
    [providers]
  )

  // Helper to parse combined value
  const parseModelValue = (value: string) => {
    const colonIndex = value.indexOf(':')
    if (colonIndex > 0) {
      return { provider: value.slice(0, colonIndex), model: value.slice(colonIndex + 1) }
    }
    return { provider: '', model: '' }
  }

  // Helper to find model info
  const findModelInfo = (value: string) => {
    const { provider, model } = parseModelValue(value)
    const providerData = configuredProviders.find((p) => p.code === provider)
    const modelData = providerData?.models.find((m) => m.id === model)
    return { providerData, modelData }
  }

  // Initialize from preferences
  useEffect(() => {
    if (!preferences || configuredProviders.length === 0) return

    if (!parsingModelValue) {
      const savedParsingProvider = preferences[PREFERENCE_KEYS.STATEMENT_PARSING_PROVIDER]
      const savedParsingModel = preferences[PREFERENCE_KEYS.STATEMENT_PARSING_MODEL]

      let parsingSet = false
      if (savedParsingProvider && savedParsingModel) {
        const providerData = configuredProviders.find((p) => p.code === savedParsingProvider)
        if (providerData?.models.some((m) => m.id === savedParsingModel)) {
          setParsingModelValue(`${savedParsingProvider}:${savedParsingModel}`)
          parsingSet = true
        }
      }
      if (!parsingSet) {
        for (const provider of configuredProviders) {
          const parsingModels = provider.models.filter((m) => m.supportsParsing)
          if (parsingModels.length > 0) {
            const recommended = parsingModels.find((m) => m.recommendedForParsing)
            const model = recommended || parsingModels[0]
            if (model) {
              setParsingModelValue(`${provider.code}:${model.id}`)
              break
            }
          }
        }
      }
    }
  }, [preferences, configuredProviders, parsingModelValue])

  const handleParsingModelChange = (value: string) => {
    setParsingModelValue(value)
    const { provider, model } = parseModelValue(value)
    savePreferenceMutation.mutate({
      key: PREFERENCE_KEYS.STATEMENT_PARSING_PROVIDER,
      value: provider,
    })
    savePreferenceMutation.mutate({ key: PREFERENCE_KEYS.STATEMENT_PARSING_MODEL, value: model })
  }

  const isValidFile = useCallback((file: File) => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      const validFiles = droppedFiles.filter(isValidFile)
      const invalidCount = droppedFiles.length - validFiles.length

      if (invalidCount > 0) {
        setError(
          `${invalidCount} file${invalidCount !== 1 ? 's' : ''} skipped (only PDF files are supported)`
        )
      } else {
        setError(null)
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles])
        setShowPasswordField(false)
        setPassword('')
      }
    },
    [isValidFile]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const selectedFiles = Array.from(e.target.files)
        const validFiles = selectedFiles.filter(isValidFile)
        const invalidCount = selectedFiles.length - validFiles.length

        if (invalidCount > 0) {
          setError(
            `${invalidCount} file${invalidCount !== 1 ? 's' : ''} skipped (only PDF files are supported)`
          )
        } else {
          setError(null)
        }

        if (validFiles.length > 0) {
          setFiles((prev) => [...prev, ...validFiles])
          setShowPasswordField(false)
          setPassword('')
        }
      }
      e.target.value = ''
    },
    [isValidFile]
  )

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0 || !profileId) return

    setIsUploading(true)
    setError(null)

    try {
      const parsing = parseModelValue(parsingModelValue)

      // Upload files sequentially
      let successCount = 0
      let failCount = 0

      for (const file of files) {
        try {
          await uploadLoan(file, profileId, {
            parsingModel: parsing.model ? `${parsing.provider}:${parsing.model}` : undefined,
            password: password || undefined,
          })
          successCount++
        } catch (err: unknown) {
          const error = err as Error & {
            response?: {
              data?: {
                error?: string
                message?: string
                passwordRequired?: boolean
              }
            }
          }
          if (error?.response?.data?.error === 'password_required') {
            setShowPasswordField(true)
            setError('This file is password protected. Please enter the password.')
            setIsUploading(false)
            return
          }
          failCount++
        }
      }

      if (successCount > 0) {
        if (failCount > 0) {
          toast.success(
            `${successCount} document${successCount !== 1 ? 's' : ''} uploaded, ${failCount} failed`
          )
        } else {
          toast.success(`${successCount} document${successCount !== 1 ? 's' : ''} uploaded!`)
        }
        onSuccess()
        resetForm()
      } else {
        setError('Failed to upload documents')
      }
    } catch {
      setError('Failed to upload documents')
    } finally {
      setIsUploading(false)
    }
  }

  const resetForm = () => {
    setFiles([])
    setPassword('')
    setShowPasswordField(false)
    setError(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  const hasPdfFiles = files.some((f) => f.name.toLowerCase().endsWith('.pdf'))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/50 bg-linear-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FileUp className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Upload Loan Document</h2>
              <p className="text-sm text-muted-foreground">
                Drop your loan documents to extract details
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Upload Error</p>
                <p className="text-sm text-destructive/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            className={cn(
              'relative rounded-xl transition-all duration-200 cursor-pointer',
              'border-2 border-dashed',
              dragActive
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : files.length > 0
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {files.length > 0 ? (
              <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                <div className="max-h-30 overflow-y-auto space-y-2 pr-1">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border/50"
                    >
                      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="w-full py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-2 rounded-lg hover:bg-primary/5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Add more files
                </button>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="mx-auto h-12 w-12 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center mb-3">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Drop your files here</p>
                <p className="text-sm text-muted-foreground">
                  or{' '}
                  <span className="text-primary font-medium cursor-pointer hover:underline">
                    browse
                  </span>{' '}
                  to select
                </p>
                <p className="text-xs text-muted-foreground mt-2">PDF only</p>
              </div>
            )}
          </div>

          {/* Password section - shows for PDFs */}
          {hasPdfFiles && (
            <div
              className={cn(
                'space-y-2.5 p-3 rounded-xl border',
                showPasswordField
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-muted/30 border-border/50'
              )}
            >
              <div className="flex items-center gap-2">
                <Lock
                  className={cn(
                    'h-4 w-4',
                    showPasswordField ? 'text-amber-500' : 'text-muted-foreground'
                  )}
                />
                <Label className="text-sm font-medium">
                  File Password
                  {!showPasswordField && (
                    <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                  )}
                </Label>
              </div>
              <Input
                type="password"
                placeholder="Enter password if file is protected"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background h-9"
              />
            </div>
          )}

          {/* AI Models */}
          <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/50">
            <Label className="text-sm font-medium">AI Model</Label>

            {configuredProviders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No AI providers configured. Please configure one in settings.
              </p>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Parsing</Label>
                <Select value={parsingModelValue} onValueChange={handleParsingModelChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select model">
                      {parsingModelValue &&
                        (() => {
                          const { providerData, modelData } = findModelInfo(parsingModelValue)
                          return providerData && modelData ? (
                            <span className="flex items-center gap-2">
                              <img
                                src={PROVIDER_LOGOS[providerData.code]}
                                alt={providerData.label}
                                className="h-4 w-4 shrink-0"
                                style={getLogoInvertStyle(providerData.code)}
                              />
                              <span className="truncate">{modelData.name}</span>
                            </span>
                          ) : null
                        })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {configuredProviders.map((provider) => {
                      const parsingModels = provider.models.filter((m) => m.supportsParsing)
                      if (parsingModels.length === 0) return null
                      return (
                        <SelectGroup key={provider.code}>
                          <SelectLabel className="flex items-center gap-2 pl-2">
                            <img
                              src={PROVIDER_LOGOS[provider.code]}
                              alt={provider.label}
                              className="h-4 w-4"
                              style={getLogoInvertStyle(provider.code)}
                            />
                            {provider.label}
                          </SelectLabel>
                          {parsingModels.map((model) => (
                            <SelectItem
                              key={`${provider.code}:${model.id}`}
                              value={`${provider.code}:${model.id}`}
                            >
                              <span className="flex items-center gap-2">
                                {model.name}
                                {model.recommendedForParsing && (
                                  <span className="text-[10px] uppercase tracking-wide font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                    Best
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-surface-elevated">
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || isUploading}
              className="min-w-35"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {files.length > 1 ? `Upload ${files.length} Files` : 'Upload Document'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Loan Detail Modal Component
// ============================================

interface LoanDetailModalProps {
  loan: Loan | null
  onOpenChange: (open: boolean) => void
  currencySymbol: string
  countryCode?: string
  institutions?: { id: string; name: string; logo: string }[]
  accounts?: { id: string; institution?: string | null; accountName?: string | null }[]
  institutionsMap?: Record<string, string>
}

function LoanDetailSheet({
  loan,
  onOpenChange,
  currencySymbol,
  countryCode,
  institutions,
  accounts,
  institutionsMap,
}: LoanDetailModalProps) {
  const [logoError, setLogoError] = useState(false)
  const [paymentLogoErrors, setPaymentLogoErrors] = useState<Record<string, boolean>>({})
  // Fetch payment history and outstanding data
  const { data: paymentHistory, isLoading: isLoadingPayments } = useLoanPaymentHistory(
    loan?.id || ''
  )
  const { data: outstandingData } = useLoanOutstanding(loan?.id || '')

  if (!loan) return null

  const config = LOAN_TYPE_CONFIG[loan.loanType]
  const Icon = config?.icon || Wallet
  const details = loan.details as Record<string, unknown> | null

  // Get institution logo path if available
  const institution = loan.institution ? institutions?.find((i) => i.id === loan.institution) : null
  const logoPath =
    loan.institution && countryCode
      ? `/institutions/${countryCode.toLowerCase()}/${loan.institution}.svg`
      : null

  // Get source account info for payment
  const getSourceAccount = (sourceAccountId: string) => {
    return accounts?.find((a) => a.id === sourceAccountId)
  }

  // Get logo path for source account
  const getSourceAccountLogoPath = (sourceAccountId: string) => {
    const sourceAccount = getSourceAccount(sourceAccountId)
    if (sourceAccount?.institution && countryCode) {
      return `/institutions/${countryCode.toLowerCase()}/${sourceAccount.institution}.svg`
    }
    return null
  }

  // Get institution name for source account
  const getSourceAccountInstitutionName = (sourceAccountId: string) => {
    const sourceAccount = getSourceAccount(sourceAccountId)
    if (sourceAccount?.institution && institutionsMap) {
      return institutionsMap[sourceAccount.institution]
    }
    return sourceAccount?.accountName || 'Account'
  }

  // Format currency - always show absolute numbers, rounded
  const formatAmount = (amount: number | null) => {
    if (amount === null) return '—'
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  }

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // Use backend-calculated outstanding data (with proper amortization)
  const totalPayable =
    outstandingData?.totalPayable ??
    (loan.emiAmount && loan.tenureMonths ? loan.emiAmount * loan.tenureMonths : null)
  const totalInterest =
    outstandingData?.totalInterest ??
    (totalPayable && loan.principalAmount ? totalPayable - loan.principalAmount : null)
  const totalPaid = outstandingData?.totalPaid ?? 0
  const paymentCount = outstandingData?.paymentCount ?? 0
  const emisCompleted = outstandingData?.emisCompleted ?? 0
  const totalEmis = outstandingData?.totalEmis ?? loan.tenureMonths ?? 0

  // Principal progress (from backend amortization calculation)
  const principalPaid = outstandingData?.principalPaid ?? 0
  const outstandingPrincipal = outstandingData?.outstandingPrincipal ?? loan.principalAmount ?? 0
  const principalProgressPercent = outstandingData?.principalProgressPercent ?? 0

  // Total repayment progress (for reference)
  const remainingPayable =
    outstandingData?.remainingPayable ??
    (totalPayable ? Math.max(0, totalPayable - totalPaid) : null)

  // Get type-specific details
  const getHomeLoanDetails = () => {
    if (!details || loan.loanType !== 'home_loan') return null
    return {
      propertyAddress: details.propertyAddress as string | undefined,
      propertyType: (details.propertyType as string)?.replace(/_/g, ' '),
      coBorrowerName: details.coBorrowerName as string | undefined,
      collateralValue: details.collateralValue as number | undefined,
    }
  }

  const getVehicleLoanDetails = () => {
    if (!details || loan.loanType !== 'vehicle_loan') return null
    return {
      vehicleMake: details.vehicleMake as string | undefined,
      vehicleModel: details.vehicleModel as string | undefined,
      vehicleYear: details.vehicleYear as number | undefined,
      registrationNumber: details.registrationNumber as string | undefined,
      vehicleType: (details.vehicleType as string)?.replace(/_/g, ' '),
    }
  }

  const getEducationLoanDetails = () => {
    if (!details || loan.loanType !== 'education_loan') return null
    return {
      institutionName: details.institutionName as string | undefined,
      courseName: details.courseName as string | undefined,
      studentName: details.studentName as string | undefined,
      moratoriumPeriod: details.moratoriumPeriod as string | undefined,
    }
  }

  const getBusinessLoanDetails = () => {
    if (!details || loan.loanType !== 'business_loan') return null
    return {
      businessName: details.businessName as string | undefined,
      loanPurpose: details.loanPurpose as string | undefined,
      collateralDetails: details.collateralDetails as string | undefined,
    }
  }

  const getGoldLoanDetails = () => {
    if (!details || loan.loanType !== 'gold_loan') return null
    return {
      goldWeight: details.goldWeight as number | undefined,
      goldPurity: details.goldPurity as string | undefined,
      collateralValue: details.collateralValue as number | undefined,
    }
  }

  const getPersonalLoanDetails = () => {
    if (!details || loan.loanType !== 'personal_loan') return null
    return {
      loanPurpose: details.loanPurpose as string | undefined,
    }
  }

  const homeDetails = getHomeLoanDetails()
  const vehicleDetails = getVehicleLoanDetails()
  const educationDetails = getEducationLoanDetails()
  const businessDetails = getBusinessLoanDetails()
  const goldDetails = getGoldLoanDetails()
  const personalDetails = getPersonalLoanDetails()

  // Check if there are any type-specific details to show
  const hasTypeDetails =
    homeDetails ||
    vehicleDetails ||
    educationDetails ||
    businessDetails ||
    goldDetails ||
    (personalDetails && personalDetails.loanPurpose)

  return (
    <Dialog open={!!loan} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh]"
        showCloseButton={false}
      >
        {/* Header with gradient background */}
        <div
          className={cn(
            'relative px-6 pt-6 pb-8',
            'bg-gradient-to-br from-card via-card to-card',
            'border-b border-border-subtle'
          )}
        >
          {/* Subtle pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />

          <DialogHeader className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0',
                    'bg-gradient-to-br shadow-lg',
                    !logoPath || logoError
                      ? config?.bgColor || 'bg-primary/10'
                      : 'bg-surface-elevated border border-border-subtle',
                    !logoPath || logoError
                      ? loan.loanType === 'home_loan' && 'from-blue-500/20 to-blue-600/20'
                      : '',
                    !logoPath || logoError
                      ? loan.loanType === 'vehicle_loan' && 'from-amber-500/20 to-amber-600/20'
                      : '',
                    !logoPath || logoError
                      ? loan.loanType === 'education_loan' &&
                          'from-emerald-500/20 to-emerald-600/20'
                      : '',
                    !logoPath || logoError
                      ? loan.loanType === 'personal_loan' && 'from-violet-500/20 to-violet-600/20'
                      : '',
                    !logoPath || logoError
                      ? loan.loanType === 'business_loan' && 'from-orange-500/20 to-orange-600/20'
                      : '',
                    !logoPath || logoError
                      ? loan.loanType === 'gold_loan' && 'from-yellow-500/20 to-yellow-600/20'
                      : ''
                  )}
                >
                  {logoPath && !logoError ? (
                    <img
                      src={logoPath}
                      alt={institution?.name || loan.lender}
                      className="h-8 w-8 object-contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <Icon className={cn('h-7 w-7', config?.color || 'text-primary')} />
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-semibold truncate">
                    {institution?.name || loan.lender}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        config?.bgColor,
                        config?.color
                      )}
                    >
                      {config?.label.replace('s', '')}
                    </span>
                    {loan.loanAccountNumber && (
                      <span className="text-sm text-muted-foreground font-mono">
                        {loan.loanAccountNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  loan.status === 'active'
                    ? 'bg-positive/10 text-positive'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {loan.status === 'active' ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-positive"></span>
                  </span>
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                <span className="capitalize">{loan.status}</span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Progress Section - Hero element */}
            {loan.principalAmount && loan.principalAmount > 0 && (
              <div className="relative rounded-2xl border border-border-subtle bg-gradient-to-br from-surface-elevated to-card p-5 overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />

                <div className="relative">
                  {/* Progress header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Target className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Principal Progress</p>
                        <p className="text-xs text-muted-foreground">
                          {emisCompleted} of {totalEmis} EMIs completed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tabular-nums text-primary">
                        {Math.round(principalProgressPercent)}%
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-4">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${principalProgressPercent}%` }}
                    />
                    {/* Shine effect */}
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"
                      style={{ width: `${principalProgressPercent}%` }}
                    />
                  </div>

                  {/* Principal breakdown */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-3 rounded-xl bg-positive/5 border border-positive/10">
                      <p className="text-xs text-muted-foreground mb-1">Principal Paid</p>
                      <p className="text-base font-semibold tabular-nums text-positive">
                        {currencySymbol}
                        {formatAmount(principalPaid)}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                      <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                      <p className="text-base font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {currencySymbol}
                        {formatAmount(outstandingPrincipal)}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-muted/50 border border-border-subtle">
                      <p className="text-xs text-muted-foreground mb-1">Principal</p>
                      <p className="text-base font-semibold tabular-nums">
                        {currencySymbol}
                        {formatAmount(loan.principalAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Total paid info */}
                  <div className="pt-3 border-t border-border-subtle flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Paid (incl. interest)</span>
                    <span className="font-semibold tabular-nums">
                      {currencySymbol}
                      {formatAmount(totalPaid)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                icon={Banknote}
                label="Principal"
                value={`${currencySymbol}${formatAmount(loan.principalAmount)}`}
                iconColor="text-blue-500"
                iconBg="bg-blue-500/10"
              />
              <MetricCard
                icon={CircleDollarSign}
                label="EMI"
                value={loan.emiAmount ? `${currencySymbol}${formatAmount(loan.emiAmount)}` : '—'}
                subtitle="/month"
                iconColor="text-emerald-500"
                iconBg="bg-emerald-500/10"
              />
              <MetricCard
                icon={Percent}
                label="Interest Rate"
                value={loan.interestRate != null ? `${loan.interestRate}%` : '—'}
                subtitle={loan.interestType || undefined}
                iconColor="text-orange-500"
                iconBg="bg-orange-500/10"
              />
              <MetricCard
                icon={TrendingDown}
                label="Total Interest"
                value={totalInterest ? `${currencySymbol}${formatAmount(totalInterest)}` : '—'}
                iconColor="text-rose-500"
                iconBg="bg-rose-500/10"
              />
            </div>

            {/* Tabs for Details and Payments */}
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-11">
                <TabsTrigger value="details" className="text-sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="payments" className="text-sm">
                  <Receipt className="h-4 w-4 mr-2" />
                  Payments
                  {paymentCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                      {paymentCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="mt-4 space-y-4">
                {/* Loan Details */}
                <div className="rounded-xl border border-border-subtle bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-subtle bg-surface-elevated">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Loan Information
                    </h3>
                  </div>
                  <div className="p-4 grid gap-0.5">
                    {loan.borrowerName && (
                      <DetailRowCompact icon={User} label="Borrower" value={loan.borrowerName} />
                    )}
                    {loan.tenureMonths != null && (
                      <DetailRowCompact
                        icon={Clock}
                        label="Tenure"
                        value={
                          loan.tenureMonths >= 12
                            ? `${Math.floor(loan.tenureMonths / 12)} years ${loan.tenureMonths % 12 > 0 ? `${loan.tenureMonths % 12} months` : ''}`
                            : `${loan.tenureMonths} months`
                        }
                      />
                    )}
                    <DetailRowCompact
                      icon={Calendar}
                      label="Disbursement"
                      value={formatDate(loan.disbursementDate)}
                    />
                    <DetailRowCompact
                      icon={Calendar}
                      label="First EMI"
                      value={formatDate(loan.firstEmiDate)}
                    />
                    <DetailRowCompact
                      icon={Calendar}
                      label="End Date"
                      value={formatDate(loan.endDate)}
                    />
                  </div>
                </div>

                {/* Type-specific Details */}
                {hasTypeDetails && (
                  <div className="rounded-xl border border-border-subtle bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border-subtle bg-surface-elevated">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        {loan.loanType === 'home_loan' && (
                          <Home className="h-4 w-4 text-blue-500" />
                        )}
                        {loan.loanType === 'vehicle_loan' && (
                          <Car className="h-4 w-4 text-amber-500" />
                        )}
                        {loan.loanType === 'education_loan' && (
                          <GraduationCap className="h-4 w-4 text-emerald-500" />
                        )}
                        {loan.loanType === 'business_loan' && (
                          <Briefcase className="h-4 w-4 text-orange-500" />
                        )}
                        {loan.loanType === 'gold_loan' && (
                          <Coins className="h-4 w-4 text-yellow-500" />
                        )}
                        {loan.loanType === 'personal_loan' && (
                          <Wallet className="h-4 w-4 text-violet-500" />
                        )}
                        {loan.loanType === 'home_loan' && 'Property Details'}
                        {loan.loanType === 'vehicle_loan' && 'Vehicle Details'}
                        {loan.loanType === 'education_loan' && 'Education Details'}
                        {loan.loanType === 'business_loan' && 'Business Details'}
                        {loan.loanType === 'gold_loan' && 'Gold Details'}
                        {loan.loanType === 'personal_loan' && 'Loan Purpose'}
                      </h3>
                    </div>
                    <div className="p-4 grid gap-0.5">
                      {/* Home Loan */}
                      {homeDetails && (
                        <>
                          {homeDetails.propertyAddress && (
                            <DetailRowCompact
                              icon={MapPin}
                              label="Address"
                              value={homeDetails.propertyAddress}
                            />
                          )}
                          {homeDetails.propertyType && (
                            <DetailRowCompact
                              icon={Building2}
                              label="Type"
                              value={homeDetails.propertyType}
                              capitalize
                            />
                          )}
                          {homeDetails.coBorrowerName && (
                            <DetailRowCompact
                              icon={User}
                              label="Co-borrower"
                              value={homeDetails.coBorrowerName}
                            />
                          )}
                          {homeDetails.collateralValue != null &&
                            homeDetails.collateralValue > 0 && (
                              <DetailRowCompact
                                icon={TrendingUp}
                                label="Property Value"
                                value={`${currencySymbol}${formatAmount(homeDetails.collateralValue)}`}
                              />
                            )}
                        </>
                      )}
                      {/* Vehicle Loan */}
                      {vehicleDetails && (
                        <>
                          {(vehicleDetails.vehicleMake || vehicleDetails.vehicleModel) && (
                            <DetailRowCompact
                              icon={Car}
                              label="Vehicle"
                              value={[
                                vehicleDetails.vehicleMake,
                                vehicleDetails.vehicleModel,
                                vehicleDetails.vehicleYear,
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            />
                          )}
                          {vehicleDetails.registrationNumber && (
                            <DetailRowCompact
                              icon={BadgeCheck}
                              label="Registration"
                              value={vehicleDetails.registrationNumber}
                            />
                          )}
                          {vehicleDetails.vehicleType && (
                            <DetailRowCompact
                              icon={FileText}
                              label="Type"
                              value={vehicleDetails.vehicleType}
                              capitalize
                            />
                          )}
                        </>
                      )}
                      {/* Education Loan */}
                      {educationDetails && (
                        <>
                          {educationDetails.institutionName && (
                            <DetailRowCompact
                              icon={Building2}
                              label="Institution"
                              value={educationDetails.institutionName}
                            />
                          )}
                          {educationDetails.courseName && (
                            <DetailRowCompact
                              icon={FileText}
                              label="Course"
                              value={educationDetails.courseName}
                            />
                          )}
                          {educationDetails.studentName && (
                            <DetailRowCompact
                              icon={User}
                              label="Student"
                              value={educationDetails.studentName}
                            />
                          )}
                          {educationDetails.moratoriumPeriod && (
                            <DetailRowCompact
                              icon={Clock}
                              label="Moratorium"
                              value={educationDetails.moratoriumPeriod}
                            />
                          )}
                        </>
                      )}
                      {/* Business Loan */}
                      {businessDetails && (
                        <>
                          {businessDetails.businessName && (
                            <DetailRowCompact
                              icon={Building2}
                              label="Business"
                              value={businessDetails.businessName}
                            />
                          )}
                          {businessDetails.loanPurpose && (
                            <DetailRowCompact
                              icon={FileText}
                              label="Purpose"
                              value={businessDetails.loanPurpose}
                            />
                          )}
                          {businessDetails.collateralDetails && (
                            <DetailRowCompact
                              icon={BadgeCheck}
                              label="Collateral"
                              value={businessDetails.collateralDetails}
                            />
                          )}
                        </>
                      )}
                      {/* Gold Loan */}
                      {goldDetails && (
                        <>
                          {goldDetails.goldWeight != null && (
                            <DetailRowCompact
                              icon={Coins}
                              label="Weight"
                              value={`${goldDetails.goldWeight} grams`}
                            />
                          )}
                          {goldDetails.goldPurity && (
                            <DetailRowCompact
                              icon={BadgeCheck}
                              label="Purity"
                              value={goldDetails.goldPurity}
                            />
                          )}
                          {goldDetails.collateralValue != null &&
                            goldDetails.collateralValue > 0 && (
                              <DetailRowCompact
                                icon={TrendingUp}
                                label="Gold Value"
                                value={`${currencySymbol}${formatAmount(goldDetails.collateralValue)}`}
                              />
                            )}
                        </>
                      )}
                      {/* Personal Loan */}
                      {personalDetails && personalDetails.loanPurpose && (
                        <DetailRowCompact
                          icon={FileText}
                          label="Purpose"
                          value={personalDetails.loanPurpose}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* File Info */}
                {loan.originalFilename && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <FileText className="h-3 w-3" />
                    <span>Source: {loan.originalFilename}</span>
                  </div>
                )}
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments" className="mt-4">
                {isLoadingPayments ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading payment history...</span>
                  </div>
                ) : paymentHistory && paymentHistory.length > 0 ? (
                  <div className="space-y-2">
                    {paymentHistory.map((payment, index) => {
                      const sourceLogoPath = getSourceAccountLogoPath(payment.accountId)
                      const sourceInstitutionName = getSourceAccountInstitutionName(
                        payment.accountId
                      )
                      const hasLogoError = paymentLogoErrors[payment.accountId]

                      return (
                        <div
                          key={payment.id}
                          className={cn(
                            'flex items-center justify-between p-4 rounded-xl border border-border-subtle',
                            'bg-card hover:bg-surface-elevated transition-colors',
                            'group cursor-default'
                          )}
                          style={{
                            animationDelay: `${index * 50}ms`,
                            animation: 'fadeInUp 0.3s ease-out forwards',
                          }}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border-subtle shrink-0">
                              {sourceLogoPath && !hasLogoError ? (
                                <img
                                  src={sourceLogoPath}
                                  alt={sourceInstitutionName}
                                  className="h-5 w-5 object-contain"
                                  onError={() =>
                                    setPaymentLogoErrors((prev) => ({
                                      ...prev,
                                      [payment.accountId]: true,
                                    }))
                                  }
                                />
                              ) : (
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {payment.summary || 'EMI Payment'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(payment.date).toLocaleDateString('en-GB', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold tabular-nums text-positive">
                              +{currencySymbol}
                              {formatAmount(payment.amount)}
                            </p>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <Receipt className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      No payments linked yet
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[280px]">
                      Payments will be auto-detected from your bank statements when you upload them
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        {/* Close button at bottom */}
        <div className="px-6 py-4 border-t border-border-subtle bg-surface-elevated">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Dialog>
  )
}

// Metric Card Component
function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  iconColor,
  iconBg,
}: {
  icon: typeof Banknote
  label: string
  value: string
  subtitle?: string
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="p-3 rounded-xl border border-border-subtle bg-card hover:bg-surface-elevated transition-colors">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center mb-2', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-base font-semibold tabular-nums leading-tight">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground capitalize">{subtitle}</p>}
    </div>
  )
}

// Compact Detail Row Component
function DetailRowCompact({
  icon: Icon,
  label,
  value,
  capitalize = false,
}: {
  icon: typeof Calendar
  label: string
  value: string | undefined | null
  capitalize?: boolean
}) {
  if (!value) return null

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <span className={cn('text-sm font-medium', capitalize && 'capitalize')}>{value}</span>
    </div>
  )
}
