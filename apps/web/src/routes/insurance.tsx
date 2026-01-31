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
  Shield,
  Heart,
  Car,
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
  Users,
  BadgeCheck,
  Building2,
  CarFront,
  Plus,
  Receipt,
  ChevronRight,
  Banknote,
  CheckCircle2,
  Percent,
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
import type { InsurancePolicy, InsurancePolicyType, Profile } from '@/lib/api'
import {
  getLLMProviders,
  getPreferences,
  setPreference,
  PREFERENCE_KEYS,
  uploadInsurancePolicy,
} from '@/lib/api'
import {
  useAuth,
  useAccounts,
  useInsurancePolicies,
  useDeleteInsurance,
  useProfileSelection,
  useInsurancePaymentHistory,
  useConstants,
} from '@/hooks'
import { cn } from '@/lib/utils'
import { PROVIDER_LOGOS, getLogoInvertStyle } from '@/lib/provider-logos'
import { toast } from 'sonner'

export const Route = createFileRoute('/insurance')({
  component: InsurancePage,
})

const POLICY_TYPE_CONFIG: Record<
  InsurancePolicyType,
  { icon: typeof Shield; label: string; color: string; bgColor: string }
> = {
  life_insurance: {
    icon: Shield,
    label: 'Life Insurance',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  health_insurance: {
    icon: Heart,
    label: 'Health Insurance',
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
  },
  vehicle_insurance: {
    icon: Car,
    label: 'Vehicle Insurance',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
}

function InsurancePage() {
  const { user, profiles } = useAuth()
  const queryClient = useQueryClient()
  const { countryCode, rawInsuranceProviders, institutions } = useConstants()
  const {
    activeProfileId,
    showFamilyView,
    selectorProfileId,
    handleProfileChange,
    handleFamilyViewChange,
  } = useProfileSelection()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null)

  // Query enabled when we have a profileId OR we're in family view
  const queryEnabled = !!activeProfileId || showFamilyView

  // Query hooks
  const { data: policies, isLoading } = useInsurancePolicies(activeProfileId, {
    enabled: queryEnabled,
    refetchInterval: (query) => {
      // Poll if any policies are pending/parsing
      const data = query.state.data
      if (!data) return false
      const hasProcessing = data.some(
        (p) => p.parseStatus === 'pending' || p.parseStatus === 'parsing'
      )
      return hasProcessing ? 3000 : false
    },
  })
  const { data: accounts } = useAccounts(activeProfileId, { enabled: queryEnabled })

  // Mutation hooks
  const deleteMutation = useDeleteInsurance(activeProfileId)

  // Separate processing policies from completed ones
  const processingPolicies =
    policies?.filter((p) => p.parseStatus === 'pending' || p.parseStatus === 'parsing') || []

  const completedPolicies =
    policies?.filter((p) => p.parseStatus === 'completed' || p.parseStatus === 'failed') || []

  // Group completed policies by type
  const policyGroups = {
    life_insurance: completedPolicies.filter((p) => p.policyType === 'life_insurance'),
    health_insurance: completedPolicies.filter((p) => p.policyType === 'health_insurance'),
    vehicle_insurance: completedPolicies.filter((p) => p.policyType === 'vehicle_insurance'),
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteMutation.mutateAsync(deleteId)
    setDeleteId(null)
  }

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['insurance'] })
    setUploadOpen(false)
  }

  const currencySymbol = user?.country === 'US' ? '$' : user?.country === 'GB' ? '£' : '₹'

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <PageHeader
          title="Insurance"
          description="Manage your insurance policies"
          actions={
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button onClick={() => setUploadOpen(true)} disabled={showFamilyView}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Policy
                    </Button>
                  </span>
                </TooltipTrigger>
                {showFamilyView && (
                  <TooltipContent>Switch to a profile to upload a policy</TooltipContent>
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

        {/* Policies Display */}
        {isLoading ? (
          <div className="space-y-8">
            {Object.entries(POLICY_TYPE_CONFIG).map(([type]) => (
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
        ) : policies && policies.length > 0 ? (
          <div className="space-y-8">
            {/* Processing Section */}
            {processingPolicies.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span>Processing</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ({processingPolicies.length})
                  </span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {processingPolicies.map((policy) => (
                    <PolicyCard
                      key={policy.id}
                      policy={policy}
                      currencySymbol={currencySymbol}
                      profiles={profiles}
                      showProfileBadge={showFamilyView}
                      onDelete={() => setDeleteId(policy.id)}
                      countryCode={countryCode}
                      insuranceProviders={rawInsuranceProviders}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed policies by type */}
            {(Object.entries(policyGroups) as [InsurancePolicyType, InsurancePolicy[]][]).map(
              ([type, typePolicies]) => {
                if (typePolicies.length === 0) return null
                const config = POLICY_TYPE_CONFIG[type]
                const Icon = config.icon

                return (
                  <section key={type}>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Icon className={cn('h-5 w-5', config.color)} />
                      {config.label}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {typePolicies.map((policy) => (
                        <PolicyCard
                          key={policy.id}
                          policy={policy}
                          currencySymbol={currencySymbol}
                          profiles={profiles}
                          showProfileBadge={showFamilyView}
                          onDelete={() => setDeleteId(policy.id)}
                          onSelect={() => setSelectedPolicy(policy)}
                          countryCode={countryCode}
                          insuranceProviders={rawInsuranceProviders}
                        />
                      ))}
                    </div>
                  </section>
                )
              }
            )}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No insurance policies yet"
            description={
              showFamilyView
                ? 'Switch to a profile to upload insurance policies.'
                : 'Upload your insurance policy documents to keep track of coverage, premiums, and renewal dates.'
            }
            action={
              showFamilyView
                ? undefined
                : {
                    label: 'Upload Policy',
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
              <AlertDialogTitle>Delete Policy</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this insurance policy? This action cannot be undone.
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

        {/* Policy Detail Sheet */}
        <PolicyDetailSheet
          policy={selectedPolicy}
          onOpenChange={(open) => !open && setSelectedPolicy(null)}
          currencySymbol={currencySymbol}
          countryCode={countryCode}
          insuranceProviders={rawInsuranceProviders}
          accounts={accounts}
          institutionsMap={institutions}
        />
      </div>
    </AppLayout>
  )
}

// ============================================
// Policy Card Component - Redesigned
// ============================================

interface PolicyCardProps {
  policy: InsurancePolicy
  currencySymbol: string
  profiles?: Profile[]
  showProfileBadge: boolean
  onDelete: () => void
  onSelect?: () => void
  countryCode?: string
  insuranceProviders?: { id: string; name: string; logo: string }[]
}

function PolicyCard({
  policy,
  currencySymbol,
  profiles,
  showProfileBadge,
  onDelete,
  onSelect,
  countryCode,
  insuranceProviders,
}: PolicyCardProps) {
  const [logoError, setLogoError] = useState(false)
  const profile = profiles?.find((p) => p.id === policy.profileId)

  const isProcessing = policy.parseStatus === 'pending' || policy.parseStatus === 'parsing'
  const isFailed = policy.parseStatus === 'failed'

  const config = POLICY_TYPE_CONFIG[policy.policyType]
  const Icon = config?.icon || Shield

  // Get institution logo path if available
  const institution = policy.institution
    ? insuranceProviders?.find((p) => p.id === policy.institution)
    : null
  const logoPath =
    policy.institution && countryCode
      ? `/institutions/${countryCode.toLowerCase()}/${policy.institution}.svg`
      : null

  // Format currency
  const formatAmount = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format end date - different display for life vs other insurance
  const formatEndDate = (dateStr: string | null, policyType: string) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const isExpired = date < now

    // For life insurance, show "ends in X years" or "ended"
    if (policyType === 'life_insurance') {
      if (isExpired) {
        return { text: 'ended', isExpired: true }
      }
      const years = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365))
      if (years < 1) {
        const months = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
        return { text: `ends in ${months} mo`, isExpired: false }
      }
      return { text: `ends in ${years} yrs`, isExpired: false }
    }

    // For health/vehicle insurance, show "renews Mon YY"
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    })

    return {
      text: isExpired ? `expired ${formatted}` : `renews ${formatted}`,
      isExpired,
    }
  }

  const endDateInfo = formatEndDate(policy.endDate, policy.policyType)

  // Get subtype from details
  const getSubtype = () => {
    const details = policy.details as Record<string, unknown> | null
    if (!details) return null

    switch (policy.policyType) {
      case 'life_insurance':
        return details.lifeInsuranceType as string | undefined
      case 'health_insurance':
        return details.healthInsuranceType as string | undefined
      case 'vehicle_insurance':
        return details.vehicleInsuranceType as string | undefined
      default:
        return null
    }
  }

  const subtype = getSubtype()?.replace(/_/g, ' ')

  // Processing card - matches pending account pattern
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
            <h3 className="font-semibold text-sm text-warning">Processing Policy</h3>
            <p className="text-xs text-muted-foreground truncate">
              {policy.originalFilename || 'Extracting details...'}
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
            This policy will be updated once parsing is complete.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-warning" />
          <span className="text-xs text-warning">
            {policy.parseStatus === 'parsing' ? 'Parsing...' : 'Awaiting processing...'}
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

  // Failed card - matches failed account pattern
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
              {policy.originalFilename || 'Policy document'}
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
            {policy.errorMessage ||
              'Failed to parse the policy. You can delete this and try uploading again.'}
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

  // Completed card - redesigned to match account cards
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
                alt={institution?.name || policy.provider}
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
                {institution?.name || policy.provider}
              </h3>
              {showProfileBadge && profile && <ProfileBadge name={profile.name} />}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {subtype && <span className="capitalize">{subtype}</span>}
              {subtype && policy.policyNumber && ' · '}
              {policy.policyNumber && <span>{policy.policyNumber}</span>}
              {!subtype && !policy.policyNumber && config?.label}
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

      {/* Premium info (like card number in credit cards) */}
      {policy.premiumAmount && (
        <p className="text-sm text-muted-foreground mt-4">
          {currencySymbol}
          {formatAmount(policy.premiumAmount)}
          {policy.premiumFrequency && <span>/{policy.premiumFrequency.replace('_', ' ')}</span>}
          {' premium'}
        </p>
      )}

      {/* Coverage - like Balance section in accounts */}
      <div className="mt-4 pt-4 border-t border-border-subtle">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Coverage</p>
        <div className="flex items-baseline justify-between mt-1">
          <p className="text-xl font-semibold text-positive tabular-nums">
            {policy.sumInsured !== null
              ? `${currencySymbol}${formatAmount(policy.sumInsured)}`
              : '—'}
          </p>
          {endDateInfo && (
            <p
              className={cn(
                'text-xs',
                endDateInfo.isExpired ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {endDateInfo.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Upload Dialog Component - Matches Statement Upload
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
          await uploadInsurancePolicy(file, profileId, {
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
            `${successCount} polic${successCount !== 1 ? 'ies' : 'y'} uploaded, ${failCount} failed`
          )
        } else {
          toast.success(`${successCount} polic${successCount !== 1 ? 'ies' : 'y'} uploaded!`)
        }
        onSuccess()
        resetForm()
      } else {
        setError('Failed to upload policies')
      }
    } catch {
      setError('Failed to upload policies')
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
              <h2 className="text-lg font-semibold text-foreground">Upload Insurance Policy</h2>
              <p className="text-sm text-muted-foreground">
                Drop your policy documents to extract details
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
                <p className="text-xs text-muted-foreground mt-2">PDF only • Max 10MB</p>
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
                  {files.length > 1 ? `Upload ${files.length} Files` : 'Upload Policy'}
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
// Policy Detail Modal Component
// ============================================

interface PolicyDetailModalProps {
  policy: InsurancePolicy | null
  onOpenChange: (open: boolean) => void
  currencySymbol: string
  countryCode?: string
  insuranceProviders?: { id: string; name: string; logo: string }[]
  accounts?: { id: string; institution?: string | null; accountName?: string | null }[]
  institutionsMap?: Record<string, string>
}

function PolicyDetailSheet({
  policy,
  onOpenChange,
  currencySymbol,
  countryCode,
  insuranceProviders,
  accounts,
  institutionsMap,
}: PolicyDetailModalProps) {
  const [logoError, setLogoError] = useState(false)
  const [paymentLogoErrors, setPaymentLogoErrors] = useState<Record<string, boolean>>({})
  // Fetch payment history
  const { data: paymentHistory, isLoading: isLoadingPayments } = useInsurancePaymentHistory(
    policy?.id || ''
  )

  if (!policy) return null

  const config = POLICY_TYPE_CONFIG[policy.policyType]
  const Icon = config?.icon || Shield
  const details = policy.details as Record<string, unknown> | null

  // Get institution logo path if available
  const institution = policy.institution
    ? insuranceProviders?.find((p) => p.id === policy.institution)
    : null
  const logoPath =
    policy.institution && countryCode
      ? `/institutions/${countryCode.toLowerCase()}/${policy.institution}.svg`
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

  // Calculate total paid from payment history
  const totalPaid = paymentHistory?.reduce((sum, p) => sum + p.amount, 0) ?? 0
  const paymentCount = paymentHistory?.length ?? 0

  // Calculate days until renewal
  const getDaysUntilRenewal = () => {
    if (!policy.endDate) return null
    const endDate = new Date(policy.endDate)
    const now = new Date()
    const diffTime = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }
  const daysUntilRenewal = getDaysUntilRenewal()
  const isExpired = daysUntilRenewal !== null && daysUntilRenewal < 0

  // Get type-specific details
  const getLifeInsuranceDetails = () => {
    if (!details || policy.policyType !== 'life_insurance') return null
    return {
      type: (details.lifeInsuranceType as string)?.replace(/_/g, ' '),
      nomineeName: details.nomineeName as string | undefined,
      nomineeRelation: details.nomineeRelation as string | undefined,
      deathBenefit: details.deathBenefit as number | undefined,
      maturityBenefit: details.maturityBenefit as number | undefined,
      riders: details.riderDetails as string[] | undefined,
    }
  }

  const getHealthInsuranceDetails = () => {
    if (!details || policy.policyType !== 'health_insurance') return null
    return {
      type: (details.healthInsuranceType as string)?.replace(/_/g, ' '),
      coveredMembers: details.coveredMembers as
        | Array<{ name?: string; relation?: string; age?: number }>
        | undefined,
      roomRentLimit: details.roomRentLimit as string | number | undefined,
      coPayPercentage: details.coPayPercentage as number | undefined,
      preExistingWaitingPeriod: details.preExistingWaitingPeriod as string | undefined,
      networkHospitals: details.networkHospitals as string | undefined,
    }
  }

  const getVehicleInsuranceDetails = () => {
    if (!details || policy.policyType !== 'vehicle_insurance') return null
    return {
      type: (details.vehicleInsuranceType as string)?.replace(/_/g, ' '),
      vehicleMake: details.vehicleMake as string | undefined,
      vehicleModel: details.vehicleModel as string | undefined,
      vehicleYear: details.vehicleYear as number | undefined,
      registrationNumber: details.registrationNumber as string | undefined,
      idv: details.idv as number | undefined,
      addOns: details.addOns as string[] | undefined,
    }
  }

  const lifeDetails = getLifeInsuranceDetails()
  const healthDetails = getHealthInsuranceDetails()
  const vehicleDetails = getVehicleInsuranceDetails()

  // Check if there are any type-specific details to show
  const hasTypeDetails = lifeDetails || healthDetails || vehicleDetails

  return (
    <Dialog open={!!policy} onOpenChange={onOpenChange}>
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
                      ? policy.policyType === 'life_insurance' && 'from-blue-500/20 to-blue-600/20'
                      : '',
                    !logoPath || logoError
                      ? policy.policyType === 'health_insurance' &&
                          'from-rose-500/20 to-rose-600/20'
                      : '',
                    !logoPath || logoError
                      ? policy.policyType === 'vehicle_insurance' &&
                          'from-amber-500/20 to-amber-600/20'
                      : ''
                  )}
                >
                  {logoPath && !logoError ? (
                    <img
                      src={logoPath}
                      alt={institution?.name || policy.provider}
                      className="h-8 w-8 object-contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <Icon className={cn('h-7 w-7', config?.color || 'text-primary')} />
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-semibold truncate">
                    {institution?.name || policy.provider}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        config?.bgColor,
                        config?.color
                      )}
                    >
                      {config?.label}
                    </span>
                    {policy.policyNumber && (
                      <span className="text-sm text-muted-foreground font-mono">
                        {policy.policyNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  policy.status === 'active' && !isExpired
                    ? 'bg-positive/10 text-positive'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {policy.status === 'active' && !isExpired ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-positive"></span>
                  </span>
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                <span className="capitalize">{isExpired ? 'Expired' : policy.status}</span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Coverage Summary Section */}
            <div className="relative rounded-2xl border border-border-subtle bg-gradient-to-br from-surface-elevated to-card p-5 overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />

              <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-positive/10 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-positive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Coverage Summary</p>
                      <p className="text-xs text-muted-foreground">
                        {daysUntilRenewal !== null &&
                          (isExpired
                            ? `Expired ${Math.abs(daysUntilRenewal)} days ago`
                            : daysUntilRenewal <= 30
                              ? `Renews in ${daysUntilRenewal} days`
                              : `Valid until ${formatDate(policy.endDate)}`)}
                      </p>
                    </div>
                  </div>
                  {daysUntilRenewal !== null && daysUntilRenewal <= 30 && daysUntilRenewal > 0 && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Renewal Soon
                    </span>
                  )}
                </div>

                {/* Amount breakdown */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-xl bg-positive/5 border border-positive/10">
                    <p className="text-xs text-muted-foreground mb-1">Sum Insured</p>
                    <p className="text-base font-semibold tabular-nums text-positive">
                      {currencySymbol}
                      {formatAmount(policy.sumInsured)}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                    <p className="text-xs text-muted-foreground mb-1">Premium</p>
                    <p className="text-base font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                      {policy.premiumAmount
                        ? `${currencySymbol}${formatAmount(policy.premiumAmount)}`
                        : '—'}
                    </p>
                    {policy.premiumFrequency && (
                      <p className="text-xs text-muted-foreground">
                        /{policy.premiumFrequency.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50 border border-border-subtle">
                    <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
                    <p className="text-base font-semibold tabular-nums">
                      {currencySymbol}
                      {formatAmount(totalPaid)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                icon={Banknote}
                label="Sum Insured"
                value={`${currencySymbol}${formatAmount(policy.sumInsured)}`}
                iconColor="text-positive"
                iconBg="bg-positive/10"
              />
              <MetricCard
                icon={Receipt}
                label="Premium"
                value={
                  policy.premiumAmount
                    ? `${currencySymbol}${formatAmount(policy.premiumAmount)}`
                    : '—'
                }
                subtitle={policy.premiumFrequency?.replace('_', ' ') || undefined}
                iconColor="text-blue-500"
                iconBg="bg-blue-500/10"
              />
              <MetricCard
                icon={Calendar}
                label="Start Date"
                value={formatDate(policy.startDate)}
                iconColor="text-emerald-500"
                iconBg="bg-emerald-500/10"
              />
              <MetricCard
                icon={Clock}
                label="End Date"
                value={formatDate(policy.endDate)}
                iconColor={isExpired ? 'text-destructive' : 'text-orange-500'}
                iconBg={isExpired ? 'bg-destructive/10' : 'bg-orange-500/10'}
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
                {/* Policy Information */}
                <div className="rounded-xl border border-border-subtle bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-subtle bg-surface-elevated">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Policy Information
                    </h3>
                  </div>
                  <div className="p-4 grid gap-0.5">
                    {policy.policyHolderName && (
                      <DetailRowCompact
                        icon={User}
                        label="Policy Holder"
                        value={policy.policyHolderName}
                      />
                    )}
                    <DetailRowCompact
                      icon={BadgeCheck}
                      label="Status"
                      value={policy.status?.replace(/_/g, ' ')}
                      capitalize
                    />
                  </div>
                </div>

                {/* Type-specific Details */}
                {hasTypeDetails && (
                  <div className="rounded-xl border border-border-subtle bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border-subtle bg-surface-elevated">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        {policy.policyType === 'life_insurance' && (
                          <Shield className="h-4 w-4 text-blue-500" />
                        )}
                        {policy.policyType === 'health_insurance' && (
                          <Heart className="h-4 w-4 text-rose-500" />
                        )}
                        {policy.policyType === 'vehicle_insurance' && (
                          <Car className="h-4 w-4 text-amber-500" />
                        )}
                        {policy.policyType === 'life_insurance' && 'Life Insurance Details'}
                        {policy.policyType === 'health_insurance' && 'Health Insurance Details'}
                        {policy.policyType === 'vehicle_insurance' && 'Vehicle Details'}
                      </h3>
                    </div>
                    <div className="p-4 grid gap-0.5">
                      {/* Life Insurance */}
                      {lifeDetails && (
                        <>
                          {lifeDetails.type && (
                            <DetailRowCompact
                              icon={FileText}
                              label="Plan Type"
                              value={lifeDetails.type}
                              capitalize
                            />
                          )}
                          {lifeDetails.nomineeName && (
                            <DetailRowCompact
                              icon={User}
                              label="Nominee"
                              value={`${lifeDetails.nomineeName}${lifeDetails.nomineeRelation ? ` (${lifeDetails.nomineeRelation})` : ''}`}
                            />
                          )}
                          {lifeDetails.deathBenefit != null && lifeDetails.deathBenefit > 0 && (
                            <DetailRowCompact
                              icon={Shield}
                              label="Death Benefit"
                              value={`${currencySymbol}${formatAmount(lifeDetails.deathBenefit)}`}
                            />
                          )}
                          {lifeDetails.maturityBenefit != null &&
                            lifeDetails.maturityBenefit > 0 && (
                              <DetailRowCompact
                                icon={BadgeCheck}
                                label="Maturity Benefit"
                                value={`${currencySymbol}${formatAmount(lifeDetails.maturityBenefit)}`}
                              />
                            )}
                          {lifeDetails.riders && lifeDetails.riders.length > 0 && (
                            <div className="py-2.5 border-b border-border-subtle last:border-0">
                              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <Plus className="h-4 w-4" />
                                <span className="text-sm">Riders</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 ml-6">
                                {lifeDetails.riders.map((rider, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2 py-1 rounded-md bg-blue-500/10 text-blue-500"
                                  >
                                    {rider}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {/* Health Insurance */}
                      {healthDetails && (
                        <>
                          {healthDetails.type && (
                            <DetailRowCompact
                              icon={FileText}
                              label="Plan Type"
                              value={healthDetails.type}
                              capitalize
                            />
                          )}
                          {healthDetails.roomRentLimit != null &&
                            healthDetails.roomRentLimit !== 0 && (
                              <DetailRowCompact
                                icon={Building2}
                                label="Room Rent"
                                value={
                                  healthDetails.roomRentLimit === 'no_limit'
                                    ? 'No Limit'
                                    : `${currencySymbol}${formatAmount(healthDetails.roomRentLimit as number)}/day`
                                }
                              />
                            )}
                          {healthDetails.coPayPercentage != null &&
                            healthDetails.coPayPercentage > 0 && (
                              <DetailRowCompact
                                icon={Percent}
                                label="Co-pay"
                                value={`${healthDetails.coPayPercentage}%`}
                              />
                            )}
                          {healthDetails.preExistingWaitingPeriod && (
                            <DetailRowCompact
                              icon={Clock}
                              label="PED Waiting"
                              value={healthDetails.preExistingWaitingPeriod}
                            />
                          )}
                          {healthDetails.networkHospitals && (
                            <DetailRowCompact
                              icon={Building2}
                              label="Network"
                              value={healthDetails.networkHospitals}
                            />
                          )}
                          {healthDetails.coveredMembers &&
                            healthDetails.coveredMembers.length > 0 && (
                              <div className="py-2.5 border-b border-border-subtle last:border-0">
                                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                  <Users className="h-4 w-4" />
                                  <span className="text-sm">
                                    Covered Members ({healthDetails.coveredMembers.length})
                                  </span>
                                </div>
                                <div className="space-y-1.5 ml-6">
                                  {healthDetails.coveredMembers.map((member, i) => (
                                    <div key={i} className="text-sm flex items-center gap-2">
                                      <span className="font-medium">{member.name || 'Member'}</span>
                                      {member.relation && (
                                        <span className="text-xs text-muted-foreground">
                                          ({member.relation})
                                        </span>
                                      )}
                                      {member.age && (
                                        <span className="text-xs text-muted-foreground">
                                          • {member.age} yrs
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </>
                      )}
                      {/* Vehicle Insurance */}
                      {vehicleDetails && (
                        <>
                          {vehicleDetails.type && (
                            <DetailRowCompact
                              icon={FileText}
                              label="Coverage"
                              value={vehicleDetails.type}
                              capitalize
                            />
                          )}
                          {(vehicleDetails.vehicleMake || vehicleDetails.vehicleModel) && (
                            <DetailRowCompact
                              icon={CarFront}
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
                          {vehicleDetails.idv != null && vehicleDetails.idv > 0 && (
                            <DetailRowCompact
                              icon={Shield}
                              label="IDV"
                              value={`${currencySymbol}${formatAmount(vehicleDetails.idv)}`}
                            />
                          )}
                          {vehicleDetails.addOns && vehicleDetails.addOns.length > 0 && (
                            <div className="py-2.5 border-b border-border-subtle last:border-0">
                              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <Plus className="h-4 w-4" />
                                <span className="text-sm">Add-ons</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 ml-6">
                                {vehicleDetails.addOns.map((addon, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-500"
                                  >
                                    {addon}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* File Info */}
                {policy.originalFilename && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <FileText className="h-3 w-3" />
                    <span>Source: {policy.originalFilename}</span>
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
                                {payment.summary || 'Premium Payment'}
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
