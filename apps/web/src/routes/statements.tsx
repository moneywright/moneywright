import { useState, useRef, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  FileUp,
  ChevronRight,
  Lock,
  CheckCircle,
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
import { useProfiles } from '@/hooks/useAuthStatus'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/statements')({
  component: StatementsPage,
})

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
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showUploadDialog, setShowUploadDialog] = useState(false)

  // Use default profile if none selected
  const activeProfileId = selectedProfileId || defaultProfile?.id

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

  const getStatusIcon = (status: Statement['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'parsing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      default:
        return <Clock className="h-4 w-4 text-zinc-500" />
    }
  }

  const getStatusLabel = (status: Statement['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'parsing':
        return 'Processing...'
      default:
        return 'Pending'
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Statements</h1>
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

        {/* Statements List */}
        {statementsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : statements && statements.length > 0 ? (
          <div className="space-y-3">
            {statements.map((statement) => (
              <Card key={statement.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                      </div>
                      <div>
                        <div className="font-medium">{statement.originalFilename}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {statement.fileSizeBytes && (
                            <>
                              <span>{formatFileSize(statement.fileSizeBytes)}</span>
                              <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            </>
                          )}
                          <span>{new Date(statement.createdAt).toLocaleDateString()}</span>
                          {statement.periodStart && statement.periodEnd && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-600">·</span>
                              <span>
                                {statement.periodStart} to {statement.periodEnd}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(statement.status)}
                        <span className="text-sm">{getStatusLabel(statement.status)}</span>
                      </div>

                      {statement.status === 'completed' && (
                        <div className="text-sm text-muted-foreground px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800">
                          {statement.transactionCount} transactions
                        </div>
                      )}

                      {statement.status === 'failed' && statement.errorMessage && (
                        <div
                          className="text-sm text-red-500 max-w-xs truncate"
                          title={statement.errorMessage}
                        >
                          {statement.errorMessage}
                        </div>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-500 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Statement?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete the statement and all its transactions. This action
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 text-white hover:bg-red-700"
                              onClick={() => deleteMutation.mutate(statement.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-zinc-400" />
                </div>
                <h3 className="text-lg font-medium">No statements yet</h3>
                <p className="mt-1 text-muted-foreground text-sm max-w-sm mx-auto">
                  Upload a bank or credit card statement to start tracking your transactions
                </p>
                <Button className="mt-6" onClick={() => setShowUploadDialog(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Statement
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}

// Upload Form Component
function UploadForm({
  profileId,
  onClose,
  onSuccess,
}: {
  profileId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [accountId, setAccountId] = useState<string>('auto')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [password, setPassword] = useState('')
  const [savePassword, setSavePassword] = useState(false)
  const [showPasswordField, setShowPasswordField] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
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

  // Set default model when loaded
  useState(() => {
    if (llmSettings?.model) {
      setSelectedModel(llmSettings.model)
    } else if (availableModels.length > 0) {
      const recommended = availableModels.find((m) => m.recommended)
      setSelectedModel(recommended?.id || availableModels[0]?.id || '')
    }
  })

  // Update selected model when provider data loads
  if (!selectedModel && availableModels.length > 0) {
    const recommended = availableModels.find((m) => m.recommended)
    setSelectedModel(recommended?.id || availableModels[0]?.id || '')
  }

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected')
      return uploadStatement(file, profileId, {
        accountId: accountId === 'auto' ? undefined : accountId,
        password: password || undefined,
        savePassword: savePassword,
        model: selectedModel || undefined,
      })
    },
    onSuccess: (result) => {
      toast.success(
        result.isNewAccount
          ? 'Statement uploaded! A new account was created.'
          : 'Statement uploaded!'
      )
      onSuccess()
    },
    onError: (
      err: Error & { response?: { data?: { passwordRequired?: boolean; message?: string } } }
    ) => {
      const response = err?.response?.data
      if (response?.passwordRequired) {
        setShowPasswordField(true)
        setError(response?.message || 'This PDF is password protected. Please enter the password.')
      } else {
        setError(response?.message || 'Failed to upload statement')
      }
    },
  })

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
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const droppedFile = e.dataTransfer.files[0]
        if (isValidFile(droppedFile)) {
          setFile(droppedFile)
          setError(null)
          setShowPasswordField(false)
          setPassword('')
        } else {
          setError('Invalid file type. Please upload a PDF or CSV file.')
        }
      }
    },
    [isValidFile]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const selectedFile = e.target.files[0]
        if (isValidFile(selectedFile)) {
          setFile(selectedFile)
          setError(null)
          setShowPasswordField(false)
          setPassword('')
        } else {
          setError('Invalid file type. Please upload a PDF or CSV file.')
        }
      }
    },
    [isValidFile]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file')
      return
    }
    setError(null)
    uploadMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Upload Statement
          </DialogTitle>
          <DialogDescription>
            Upload a bank or credit card statement to extract transactions
          </DialogDescription>
        </DialogHeader>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* File Drop Zone */}
        <div
          className={cn(
            'relative border-2 border-dashed rounded-xl transition-all cursor-pointer',
            dragActive
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
              : file
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
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
            onChange={handleFileSelect}
            className="hidden"
          />
          {file ? (
            <div className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{file.name}</div>
                <div className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB · Ready to upload
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                <Upload className="h-5 w-5 text-zinc-500" />
              </div>
              <p className="text-sm font-medium">
                Drop your statement here, or{' '}
                <span className="text-emerald-600 dark:text-emerald-400">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Supports PDF and CSV files</p>
            </div>
          )}
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Auto-detect
                  </span>
                </SelectItem>
                {accounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountName || account.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              AI Model
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
            </Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="flex items-center gap-2">
                      {model.name}
                      {model.recommended && (
                        <span className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Password field for PDFs */}
        {file && file.name.toLowerCase().endsWith('.pdf') && (
          <PasswordField
            accountId={accountId}
            accounts={accounts || []}
            password={password}
            setPassword={setPassword}
            savePassword={savePassword}
            setSavePassword={setSavePassword}
            showPasswordField={showPasswordField}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!file || uploadMutation.isPending}>
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              Upload
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

// Password Field Component - shows saved password status
function PasswordField({
  accountId,
  accounts,
  password,
  setPassword,
  savePassword,
  setSavePassword,
  showPasswordField,
}: {
  accountId: string
  accounts: Account[]
  password: string
  setPassword: (password: string) => void
  savePassword: boolean
  setSavePassword: (save: boolean) => void
  showPasswordField: boolean
}) {
  // Check if selected account has a saved password
  const selectedAccount = accountId !== 'auto' ? accounts.find((a) => a.id === accountId) : null
  const hasSavedPassword = selectedAccount?.hasStatementPassword || false

  // If account has saved password and no error yet, show a simple message
  if (hasSavedPassword && !showPasswordField) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-sm">
        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span className="text-emerald-700 dark:text-emerald-300">
          Saved password will be used for this account
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'space-y-3 p-4 rounded-lg border transition-colors',
        showPasswordField
          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
          : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800'
      )}
    >
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          {showPasswordField ? (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          ) : (
            <Lock className="h-4 w-4 text-zinc-400" />
          )}
          PDF Password
          {!showPasswordField && (
            <span className="text-muted-foreground font-normal">(if protected)</span>
          )}
        </Label>
      </div>
      <div className="space-y-2">
        <Input
          type="password"
          placeholder="Enter password if PDF is protected"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10"
        />
        {password && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={savePassword}
              onChange={(e) => setSavePassword(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span className="text-muted-foreground">Save password for future uploads</span>
          </label>
        )}
      </div>
    </div>
  )
}
