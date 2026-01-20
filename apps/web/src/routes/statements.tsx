import { useState, useRef, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Loader2,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  X,
  AlertCircle,
  Sparkles,
  Lock,
  CheckCircle,
  Building2,
  CreditCard,
  Filter,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getStatements,
  uploadStatement,
  deleteStatement,
  getAccounts,
  getLLMSettings,
  getLLMProviders,
  type Statement,
  type Account,
} from '@/lib/api'
import { useProfiles, useAuthStatus } from '@/hooks/useAuthStatus'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/statements')({
  component: StatementsPage,
})

// Sort options
type SortOption = 'period_desc' | 'period_asc' | 'upload_desc' | 'upload_asc'

const SORT_STORAGE_KEY = 'statements_sort_order'
const PARSING_MODEL_STORAGE_KEY = 'statements_parsing_model'
const CATEGORIZATION_MODEL_STORAGE_KEY = 'statements_categorization_model'

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'period_desc', label: 'Period (Newest)', icon: <ArrowDown className="h-3.5 w-3.5" /> },
  { value: 'period_asc', label: 'Period (Oldest)', icon: <ArrowUp className="h-3.5 w-3.5" /> },
  {
    value: 'upload_desc',
    label: 'Upload Date (Newest)',
    icon: <ArrowDown className="h-3.5 w-3.5" />,
  },
  { value: 'upload_asc', label: 'Upload Date (Oldest)', icon: <ArrowUp className="h-3.5 w-3.5" /> },
]

// Provider logo mapping
const providerLogos: Record<string, string> = {
  openai: '/openai.svg',
  anthropic: '/anthropic.svg',
  google: '/google.svg',
  ollama: '/ollama.svg',
  vercel: '/vercel.svg',
}

// Providers that need white fill (dark logos)
const invertedLogos = ['openai', 'vercel', 'ollama']

function StatementsPage() {
  const queryClient = useQueryClient()
  const { profiles, defaultProfile } = useProfiles()
  const { user } = useAuthStatus()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOption>(() => {
    // Load from localStorage
    const saved = localStorage.getItem(SORT_STORAGE_KEY)
    return (saved as SortOption) || 'period_desc'
  })

  // Persist sort order to localStorage
  const handleSortChange = (value: SortOption) => {
    setSortOrder(value)
    localStorage.setItem(SORT_STORAGE_KEY, value)
  }

  // Use default profile if none selected
  const activeProfileId = selectedProfileId || defaultProfile?.id

  // User's country for institution logos
  const countryCode = user?.country?.toLowerCase() || 'in'

  // Fetch statements
  const { data: statements, isLoading: statementsLoading } = useQuery({
    queryKey: ['statements', activeProfileId],
    queryFn: () => getStatements(activeProfileId),
    enabled: !!activeProfileId,
    refetchInterval: (query) => {
      // Poll every 3 seconds if any statement is processing
      const data = query.state.data
      if (data?.some((s) => s.status === 'pending' || s.status === 'parsing')) {
        return 3000
      }
      return false
    },
  })

  // Fetch accounts to join with statements
  const { data: accounts } = useQuery({
    queryKey: ['accounts', activeProfileId],
    queryFn: () => getAccounts(activeProfileId),
    enabled: !!activeProfileId,
  })

  // Create account lookup map
  const accountMap = new Map(accounts?.map((a) => [a.id, a]) || [])

  // Filter and sort statements
  const filteredAndSortedStatements = (() => {
    const result = accountFilter
      ? statements?.filter((s) => s.accountId === accountFilter)
      : statements

    if (!result) return result

    return [...result].sort((a, b) => {
      switch (sortOrder) {
        case 'period_desc': {
          // Sort by period end date (newest first), fallback to upload date
          const dateA = a.periodEnd || a.periodStart || a.createdAt
          const dateB = b.periodEnd || b.periodStart || b.createdAt
          return new Date(dateB).getTime() - new Date(dateA).getTime()
        }
        case 'period_asc': {
          // Sort by period start date (oldest first), fallback to upload date
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteStatement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statements'] })
      toast.success('Statement deleted')
    },
    onError: () => {
      toast.error('Failed to delete statement')
    },
  })

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

  // Get selected account for filter display
  const selectedFilterAccount = accountFilter ? accountMap.get(accountFilter) : null

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Statements</h1>
            <p className="text-muted-foreground">Upload and manage your financial statements</p>
          </div>
          <div className="flex items-center gap-4">
            <ProfileSelector
              profiles={profiles || []}
              selectedProfileId={activeProfileId || ''}
              onProfileChange={setSelectedProfileId}
            />
            <Button onClick={() => setShowUploadDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Statement
            </Button>
          </div>
        </div>

        {/* Filter & Sort Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Account Filter */}
          {accounts && accounts.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={accountFilter ? 'secondary' : 'outline'} size="sm" className="h-9">
                  <Filter className="mr-2 h-4 w-4" />
                  {selectedFilterAccount
                    ? selectedFilterAccount.accountName || selectedFilterAccount.institution
                    : 'All Accounts'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  <Button
                    variant={!accountFilter ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setAccountFilter(null)}
                  >
                    {!accountFilter && <Check className="mr-2 h-4 w-4" />}
                    All Accounts
                  </Button>
                  {accounts.map((account) => (
                    <Button
                      key={account.id}
                      variant={accountFilter === account.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start truncate"
                      onClick={() => setAccountFilter(account.id)}
                    >
                      {accountFilter === account.id && <Check className="mr-2 h-4 w-4 shrink-0" />}
                      <span className="truncate">
                        {account.accountName || account.institution || account.type}
                      </span>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {accountFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAccountFilter(null)}
              className="h-9 text-muted-foreground"
            >
              <X className="mr-1 h-4 w-4" />
              Clear filter
            </Button>
          )}

          {/* Sort Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {sortOptions.find((o) => o.value === sortOrder)?.label || 'Sort'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1">
                {sortOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={sortOrder === option.value ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleSortChange(option.value)}
                  >
                    {sortOrder === option.value && <Check className="mr-2 h-4 w-4" />}
                    <span className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </span>
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {filteredAndSortedStatements && (
            <span className="text-sm text-muted-foreground">
              {filteredAndSortedStatements.length} statement
              {filteredAndSortedStatements.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
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
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAndSortedStatements && filteredAndSortedStatements.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedStatements.map((statement) => {
              const account = accountMap.get(statement.accountId)
              const logoPath = account?.institution
                ? `/institutions/${countryCode}/${account.institution}.svg`
                : null

              return (
                <StatementCard
                  key={statement.id}
                  statement={statement}
                  account={account}
                  logoPath={logoPath}
                  formatFileSize={formatFileSize}
                  formatPeriod={formatPeriod}
                  onDelete={() => deleteMutation.mutate(statement.id)}
                />
              )
            })}
          </div>
        ) : (
          <div
            className={cn(
              'rounded-xl p-12 text-center',
              'bg-zinc-50 dark:bg-zinc-900/50',
              'border border-dashed border-zinc-200 dark:border-zinc-800'
            )}
          >
            <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              {accountFilter ? 'No statements for this account' : 'No statements yet'}
            </h3>
            <p className="mt-2 text-muted-foreground text-sm max-w-sm mx-auto">
              {accountFilter
                ? 'Upload a statement for this account or clear the filter to see all statements'
                : 'Upload a bank or credit card statement to start tracking your transactions'}
            </p>
            <Button className="mt-6" onClick={() => setShowUploadDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Statement
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// Statement Card Component - Clean, Simple Design
function StatementCard({
  statement,
  account,
  logoPath,
  formatFileSize,
  formatPeriod,
  onDelete,
}: {
  statement: Statement
  account: Account | undefined
  logoPath: string | null
  formatFileSize: (bytes: number | null) => string
  formatPeriod: (start: string | null, end: string | null) => string | null
  onDelete: () => void
}) {
  const [logoError, setLogoError] = useState(false)

  const getStatusConfig = (status: Statement['status']) => {
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          label: 'Completed',
          className: 'text-emerald-600 dark:text-emerald-400',
        }
      case 'failed':
        return {
          icon: <XCircle className="h-3.5 w-3.5" />,
          label: 'Failed',
          className: 'text-red-500 dark:text-red-400',
        }
      case 'parsing':
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          label: 'Processing',
          className: 'text-blue-500 dark:text-blue-400',
        }
      default:
        return {
          icon: <Clock className="h-3.5 w-3.5" />,
          label: 'Pending',
          className: 'text-zinc-500 dark:text-zinc-400',
        }
    }
  }

  const status = getStatusConfig(statement.status)
  const isCreditCard = account?.type === 'credit_card'
  const periodLabel = formatPeriod(statement.periodStart, statement.periodEnd)
  const accountNumber = account?.accountNumber?.slice(-4)

  return (
    <div
      className={cn(
        'group relative rounded-xl overflow-hidden transition-all duration-200',
        'bg-white dark:bg-zinc-900',
        'border border-zinc-200 dark:border-zinc-800',
        'hover:border-zinc-300 dark:hover:border-zinc-700',
        'hover:shadow-md dark:hover:shadow-zinc-950/50'
      )}
    >
      <div className="p-4">
        {/* Header: Logo + Account Info + Status */}
        <div className="flex items-start gap-3 mb-3">
          {/* Institution Logo */}
          <div
            className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden',
              'bg-zinc-100 dark:bg-zinc-800'
            )}
          >
            {logoPath && !logoError ? (
              <img
                src={logoPath}
                alt={account?.institution || ''}
                className="h-6 w-6 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : isCreditCard ? (
              <CreditCard className="h-4 w-4 text-zinc-400" />
            ) : (
              <Building2 className="h-4 w-4 text-zinc-400" />
            )}
          </div>

          {/* Account Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate text-sm leading-tight">
              {account?.accountName || account?.institution || 'Unknown Account'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {accountNumber
                ? `•••• ${accountNumber}`
                : isCreditCard
                  ? 'Credit Card'
                  : 'Bank Account'}
            </p>
          </div>

          {/* Status */}
          <div
            className={cn('flex items-center gap-1 text-xs font-medium shrink-0', status.className)}
          >
            {status.icon}
          </div>
        </div>

        {/* Period + Transaction Count */}
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 mb-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium block">
              {periodLabel ? 'Period' : 'Uploaded'}
            </span>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {periodLabel ||
                new Date(statement.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
            </span>
          </div>

          {statement.status === 'completed' && (
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium block">
                Transactions
              </span>
              <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                {statement.transactionCount}
              </span>
            </div>
          )}

          {statement.status === 'parsing' && (
            <div className="text-right">
              <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">
                Processing...
              </span>
            </div>
          )}

          {statement.status === 'pending' && (
            <div className="text-right">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Queued</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {statement.status === 'failed' && statement.errorMessage && (
          <div className="mb-3 py-2 px-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
            <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2">
              {statement.errorMessage}
            </p>
          </div>
        )}

        {/* Footer: File Info + Delete */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 min-w-0">
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[140px]" title={statement.originalFilename}>
              {statement.originalFilename}
            </span>
            <span>•</span>
            <span className="shrink-0">{formatFileSize(statement.fileSizeBytes)}</span>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Statement?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the statement and all its transactions. This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={onDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}

// Upload Form Component - supports multiple files
function UploadForm({
  profileId,
  onClose,
  onSuccess,
}: {
  profileId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [accountId, setAccountId] = useState<string>('auto')
  const [parsingModel, setParsingModel] = useState<string>(() => {
    // Load from localStorage
    return localStorage.getItem(PARSING_MODEL_STORAGE_KEY) || ''
  })
  const [categorizationModel, setCategorizationModel] = useState<string>(() => {
    // Load from localStorage
    return localStorage.getItem(CATEGORIZATION_MODEL_STORAGE_KEY) || ''
  })
  const [password, setPassword] = useState('')
  const [savePassword, setSavePassword] = useState(false)
  const [showPasswordField, setShowPasswordField] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ['accounts', profileId],
    queryFn: () => getAccounts(profileId),
  })

  // Fetch LLM settings and providers
  const { data: llmSettings } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: getLLMSettings,
  })

  const { data: providers } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: getLLMProviders,
  })

  // Get current provider's models
  const currentProvider = providers?.find((p) => p.code === llmSettings?.provider)
  const availableModels = currentProvider?.models || []

  // Filter models: parsing models must have supportsParsing=true
  const parsingModels = availableModels.filter((m) => m.supportsParsing)
  const categorizationModels = availableModels // All models can be used for categorization

  // Handle parsing model change with localStorage persistence
  const handleParsingModelChange = (modelId: string) => {
    setParsingModel(modelId)
    localStorage.setItem(PARSING_MODEL_STORAGE_KEY, modelId)
  }

  // Handle categorization model change with localStorage persistence
  const handleCategorizationModelChange = (modelId: string) => {
    setCategorizationModel(modelId)
    localStorage.setItem(CATEGORIZATION_MODEL_STORAGE_KEY, modelId)
  }

  // Update models when provider data loads - only if not already set from localStorage
  if (parsingModels.length > 0) {
    // Check if saved model is still valid for this provider
    const savedParsingModel = localStorage.getItem(PARSING_MODEL_STORAGE_KEY)
    const isValidSavedParsing =
      savedParsingModel && parsingModels.some((m) => m.id === savedParsingModel)

    if (!parsingModel || (!isValidSavedParsing && parsingModel === savedParsingModel)) {
      const recommended = parsingModels.find((m) => m.recommendedForParsing)
      const defaultModel = recommended?.id || parsingModels[0]?.id || ''
      if (parsingModel !== defaultModel) {
        setParsingModel(defaultModel)
      }
    }
  }

  if (categorizationModels.length > 0) {
    // Check if saved model is still valid for this provider
    const savedCategorizationModel = localStorage.getItem(CATEGORIZATION_MODEL_STORAGE_KEY)
    const isValidSavedCategorization =
      savedCategorizationModel &&
      categorizationModels.some((m) => m.id === savedCategorizationModel)

    if (
      !categorizationModel ||
      (!isValidSavedCategorization && categorizationModel === savedCategorizationModel)
    ) {
      const recommended = categorizationModels.find((m) => m.recommendedForCategorization)
      const defaultModel = recommended?.id || categorizationModels[0]?.id || ''
      if (categorizationModel !== defaultModel) {
        setCategorizationModel(defaultModel)
      }
    }
  }

  const [isUploading, setIsUploading] = useState(false)

  const uploadFiles = async () => {
    if (files.length === 0) {
      setError('Please select at least one file')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadProgress({ current: 0, total: files.length })

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadProgress({ current: i + 1, total: files.length })

      try {
        await uploadStatement(file, profileId, {
          accountId: accountId === 'auto' ? undefined : accountId,
          password: password || undefined,
          savePassword: savePassword && i === 0, // Only save password on first upload
          parsingModel: parsingModel || undefined,
          categorizationModel: categorizationModel || undefined,
        })
        successCount++
      } catch (err: unknown) {
        failCount++
        const error = err as Error & {
          response?: { data?: { passwordRequired?: boolean; message?: string } }
        }
        if (error?.response?.data?.passwordRequired && files.length === 1) {
          // Only show password field for single file upload
          setShowPasswordField(true)
          setError(
            error.response.data.message ||
              'This PDF is password protected. Please enter the password.'
          )
          setIsUploading(false)
          setUploadProgress(null)
          return
        }
        console.error(`Failed to upload ${file.name}:`, err)
      }
    }

    setIsUploading(false)
    setUploadProgress(null)

    if (successCount > 0) {
      if (failCount > 0) {
        toast.success(
          `${successCount} statement${successCount !== 1 ? 's' : ''} uploaded, ${failCount} failed`
        )
      } else {
        toast.success(`${successCount} statement${successCount !== 1 ? 's' : ''} uploaded!`)
      }
      onSuccess()
    } else {
      setError('Failed to upload statements')
    }
  }

  const isValidFile = useCallback((file: File) => {
    const validTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel']
    const validExtensions = ['.pdf', '.csv']
    return (
      validTypes.includes(file.type) ||
      validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    )
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
          `${invalidCount} file${invalidCount !== 1 ? 's' : ''} skipped (only PDF and CSV files are supported)`
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
            `${invalidCount} file${invalidCount !== 1 ? 's' : ''} skipped (only PDF and CSV files are supported)`
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
      // Reset input so same file can be selected again
      e.target.value = ''
    },
    [isValidFile]
  )

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    uploadFiles()
  }

  // Check if selected account has a saved password
  const selectedAccount = accountId !== 'auto' ? accounts?.find((a) => a.id === accountId) : null
  const hasSavedPassword = selectedAccount?.hasStatementPassword || false
  const hasPDFs = files.some((f) => f.name.toLowerCase().endsWith('.pdf'))

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Upload Statements</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Upload one or more bank or credit card statements to automatically extract and
            categorize transactions.
          </DialogDescription>
        </DialogHeader>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* File Drop Zone */}
        <div
          className={cn(
            'relative rounded-lg transition-all duration-200 cursor-pointer group',
            'border-2 border-dashed',
            dragActive
              ? 'border-primary bg-primary/5'
              : files.length > 0
                ? 'border-primary/50 bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/30'
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
            accept=".pdf,.csv"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {files.length > 0 ? (
            <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 p-2 rounded-md bg-background/50"
                >
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
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
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <button
                type="button"
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Add more files
              </button>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto h-11 w-11 rounded-lg bg-muted flex items-center justify-center mb-3 group-hover:bg-muted/80 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm">
                <span className="font-medium">Drop your files here</span>
                <span className="text-muted-foreground"> or </span>
                <span className="font-medium text-primary">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                PDF or CSV files up to 10MB each
              </p>
            </div>
          )}
        </div>

        {/* Account Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Auto-detect" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Auto-detect from statement
                </span>
              </SelectItem>
              {accounts && accounts.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Your accounts
                  </div>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <span className="flex items-center gap-2">
                        {account.type === 'credit_card' ? (
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {account.accountName || account.institution || account.type}
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The bank or credit card account this statement belongs to
          </p>
        </div>

        {/* PDF Password Section */}
        {hasPDFs && (showPasswordField || !hasSavedPassword) && (
          <div
            className={cn(
              'space-y-3 p-4 rounded-lg border',
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
                PDF Password
                {!showPasswordField && (
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                )}
              </Label>
            </div>
            <Input
              type="password"
              placeholder="Enter password if PDF is protected"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background"
            />
            {files.length > 1 && (
              <p className="text-xs text-muted-foreground">
                If multiple files are password-protected, they must all use the same password.
              </p>
            )}
            {password && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={savePassword}
                  onChange={(e) => setSavePassword(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-muted-foreground">Remember password for this account</span>
              </label>
            )}
          </div>
        )}

        {/* Saved Password Indicator */}
        {hasPDFs && hasSavedPassword && !showPasswordField && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              Saved password will be used for this account
            </span>
          </div>
        )}

        {/* Model Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">AI Models</Label>
            {currentProvider && (
              <img
                src={providerLogos[currentProvider.code]}
                alt={currentProvider.label}
                className={cn(
                  'h-3.5 w-3.5',
                  invertedLogos.includes(currentProvider.code) && 'invert dark:invert-0'
                )}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Parsing Model */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Parsing</Label>
              <Select value={parsingModel} onValueChange={handleParsingModelChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {parsingModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
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
                </SelectContent>
              </Select>
            </div>

            {/* Categorization Model */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categorization</Label>
              <Select value={categorizationModel} onValueChange={handleCategorizationModelChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {categorizationModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <span className="flex items-center gap-2">
                        {model.name}
                        {model.recommendedForCategorization && (
                          <span className="text-[10px] uppercase tracking-wide font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            Best
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Parsing requires a capable model for accurate extraction. Categorization can use a
            smaller, faster model.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border/50 bg-muted/30 flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button type="submit" disabled={files.length === 0 || isUploading}>
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadProgress
                ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
                : 'Uploading...'}
            </>
          ) : files.length > 1 ? (
            `Upload ${files.length} Statements`
          ) : (
            'Upload Statement'
          )}
        </Button>
      </div>
    </form>
  )
}
