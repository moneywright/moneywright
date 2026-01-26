import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AccountSelector } from '@/components/ui/account-selector'
import {
  Loader2,
  Upload,
  FileText,
  X,
  AlertCircle,
  Lock,
  CheckCircle,
  Building2,
  TrendingUp,
  ChevronLeft,
  Check,
  FileUp,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getAccounts,
  getInvestmentTypes,
  getLLMProviders,
  uploadStatements,
  getPreferences,
  setPreference,
  PREFERENCE_KEYS,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { PROVIDER_LOGOS, getLogoInvertStyle } from '@/lib/provider-logos'

type DocumentType = 'bank_statement' | 'investment_statement'
type WizardStep = 'type' | 'source' | 'upload'

interface UploadFormProps {
  profileId: string
  onClose: () => void
  onSuccess: () => void
}

export function UploadForm({ profileId, onClose, onSuccess }: UploadFormProps) {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState<WizardStep>('type')
  const [documentType, setDocumentType] = useState<DocumentType | null>(null)
  const [sourceType, setSourceType] = useState<string>('')

  const [files, setFiles] = useState<File[]>([])
  const [accountId, setAccountId] = useState<string>('auto')
  // Combined provider:model values (e.g., "openai:gpt-4o")
  const [parsingModelValue, setParsingModelValue] = useState<string>('')
  const [categorizationModelValue, setCategorizationModelValue] = useState<string>('')
  const [categorizationHints, setCategorizationHints] = useState<string>('')
  const [password, setPassword] = useState('')
  const [savePassword, setSavePassword] = useState(true)
  const [showPasswordField, setShowPasswordField] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: accounts } = useQuery({
    queryKey: ['accounts', profileId],
    queryFn: () => getAccounts(profileId),
  })

  const { data: investmentTypes } = useQuery({
    queryKey: ['investment-types'],
    queryFn: getInvestmentTypes,
  })

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

  // Initialize from preferences - syncs state with async-loaded preferences

  useEffect(() => {
    if (!preferences || configuredProviders.length === 0) return

    // Parsing model
    if (!parsingModelValue) {
      const savedParsingProvider = preferences[PREFERENCE_KEYS.STATEMENT_PARSING_PROVIDER]
      const savedParsingModel = preferences[PREFERENCE_KEYS.STATEMENT_PARSING_MODEL]

      let parsingSet = false
      if (savedParsingProvider && savedParsingModel) {
        // Verify the saved provider is still configured
        const providerData = configuredProviders.find((p) => p.code === savedParsingProvider)
        if (providerData?.models.some((m) => m.id === savedParsingModel)) {
          setParsingModelValue(`${savedParsingProvider}:${savedParsingModel}`)
          parsingSet = true
        }
      }
      // If no saved preference or invalid, set a default
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

    // Categorization model
    if (!categorizationModelValue) {
      const savedCategorizationProvider =
        preferences[PREFERENCE_KEYS.STATEMENT_CATEGORISATION_PROVIDER]
      const savedCategorizationModel = preferences[PREFERENCE_KEYS.STATEMENT_CATEGORISATION_MODEL]

      let categorizationSet = false
      if (savedCategorizationProvider && savedCategorizationModel) {
        const providerData = configuredProviders.find((p) => p.code === savedCategorizationProvider)
        if (providerData?.models.some((m) => m.id === savedCategorizationModel)) {
          setCategorizationModelValue(`${savedCategorizationProvider}:${savedCategorizationModel}`)
          categorizationSet = true
        }
      }
      // If no saved preference or invalid, set a default
      if (!categorizationSet) {
        for (const provider of configuredProviders) {
          if (provider.models.length > 0) {
            const recommended = provider.models.find((m) => m.recommendedForCategorization)
            const model = recommended || provider.models[0]
            if (model) {
              setCategorizationModelValue(`${provider.code}:${model.id}`)
              break
            }
          }
        }
      }
    }
  }, [preferences, configuredProviders, parsingModelValue, categorizationModelValue])

  const handleParsingModelChange = (value: string) => {
    setParsingModelValue(value)
    const { provider, model } = parseModelValue(value)
    savePreferenceMutation.mutate({
      key: PREFERENCE_KEYS.STATEMENT_PARSING_PROVIDER,
      value: provider,
    })
    savePreferenceMutation.mutate({ key: PREFERENCE_KEYS.STATEMENT_PARSING_MODEL, value: model })
  }

  const handleCategorizationModelChange = (value: string) => {
    setCategorizationModelValue(value)
    const { provider, model } = parseModelValue(value)
    savePreferenceMutation.mutate({
      key: PREFERENCE_KEYS.STATEMENT_CATEGORISATION_PROVIDER,
      value: provider,
    })
    savePreferenceMutation.mutate({
      key: PREFERENCE_KEYS.STATEMENT_CATEGORISATION_MODEL,
      value: model,
    })
  }

  const uploadFiles = async () => {
    if (files.length === 0) {
      setError('Please select at least one file')
      return
    }

    if (!documentType) {
      setError('Please select a statement type')
      return
    }

    if (documentType === 'investment_statement' && !sourceType) {
      setError('Please select an investment source')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const parsing = parseModelValue(parsingModelValue)
      const categorization = parseModelValue(categorizationModelValue)

      const result = await uploadStatements(files, profileId, {
        documentType,
        accountId:
          documentType === 'bank_statement' && accountId !== 'auto' ? accountId : undefined,
        sourceType: documentType === 'investment_statement' ? sourceType : undefined,
        password: password || undefined,
        savePassword,
        parsingProvider: parsing.provider || undefined,
        parsingModel: parsing.model || undefined,
        categorizationProvider: categorization.provider || undefined,
        categorizationModel: categorization.model || undefined,
        categorizationHints: categorizationHints.trim() || undefined,
      })

      const successCount = result.processedCount
      const failCount = result.errors?.length || 0

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
    } catch (err: unknown) {
      const error = err as Error & {
        response?: {
          data?: {
            passwordRequired?: boolean
            message?: string
            errors?: Array<{ filename: string; error: string }>
          }
        }
      }
      if (error?.response?.data?.passwordRequired) {
        setShowPasswordField(true)
        setError(
          error.response.data.message ||
            'This file is password protected. Please enter the password.'
        )
      } else {
        setError(error?.response?.data?.message || 'Failed to upload statements')
      }
    } finally {
      setIsUploading(false)
    }
  }

  const isValidFile = useCallback((file: File) => {
    const validTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    const validExtensions = ['.pdf', '.csv', '.xls', '.xlsx']
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
          `${invalidCount} file${invalidCount !== 1 ? 's' : ''} skipped (only PDF, CSV, and Excel files are supported)`
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
            `${invalidCount} file${invalidCount !== 1 ? 's' : ''} skipped (only PDF, CSV, and Excel files are supported)`
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    uploadFiles()
  }

  const selectedAccount = accountId !== 'auto' ? accounts?.find((a) => a.id === accountId) : null
  const hasSavedPassword = selectedAccount?.hasStatementPassword || false
  const hasPasswordProtectableFiles = files.some((f) => {
    const name = f.name.toLowerCase()
    return name.endsWith('.pdf') || name.endsWith('.xlsx') || name.endsWith('.xls')
  })

  const goToPrevStep = () => {
    if (currentStep === 'upload') {
      if (documentType === 'investment_statement') {
        setCurrentStep('source')
      } else {
        setCurrentStep('type')
      }
    } else if (currentStep === 'source') {
      setCurrentStep('type')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/50 bg-linear-to-br from-primary/5 to-transparent shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <FileUp className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Upload Statement</h2>
            <p className="text-sm text-muted-foreground">
              {currentStep === 'type' && 'Select the type of statement you want to upload'}
              {currentStep === 'source' && 'Choose your investment platform'}
              {currentStep === 'upload' && 'Drop your files to start processing'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {error && (
          <div className="mx-6 mt-6 flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Upload Error</p>
              <p className="text-sm text-destructive/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Type Selection */}
        {currentStep === 'type' && (
          <div
            className="h-full flex flex-col items-center justify-center px-6 py-6"
            style={{ minHeight: '400px' }}
          >
            <div className="space-y-4 w-full max-w-lg">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setDocumentType('bank_statement')
                    setCurrentStep('upload')
                  }}
                  className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all border-border/50 hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-surface-elevated border border-border-subtle group-hover:border-primary/30 group-hover:bg-primary/10 transition-colors">
                    <Building2 className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">Bank / Credit Card</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Extract transactions & balances
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDocumentType('investment_statement')
                    setCurrentStep('source')
                  }}
                  className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all border-border/50 hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-surface-elevated border border-border-subtle group-hover:border-primary/30 group-hover:bg-primary/10 transition-colors">
                    <TrendingUp className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">Investment</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Import holdings & portfolio
                    </p>
                  </div>
                </button>
              </div>

              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center">
                  Supported formats: PDF, CSV, Excel (.xlsx, .xls) • Max file size: 10MB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Source Selection (Investment only) */}
        {currentStep === 'source' && (
          <div className="px-6 py-6">
            <div className="grid grid-cols-3 gap-3">
              {investmentTypes?.sourceTypes.map((st) => (
                <button
                  key={st.code}
                  type="button"
                  onClick={() => {
                    setSourceType(st.code)
                    setCurrentStep('upload')
                  }}
                  className="group flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all text-center border-border/50 hover:border-primary hover:bg-primary/5"
                >
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border-subtle group-hover:border-primary/30 overflow-hidden">
                    {st.logo ? (
                      <img src={st.logo} alt={st.label} className="h-6 w-6 object-contain" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-xs font-medium text-foreground">{st.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Upload */}
        {currentStep === 'upload' && (
          <div className="px-6 py-6 space-y-5">
            {/* Selected type indicator */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated border border-border-subtle">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10 overflow-hidden shrink-0">
                {documentType === 'investment_statement' ? (
                  investmentTypes?.sourceTypes.find((st) => st.code === sourceType)?.logo ? (
                    <img
                      src={investmentTypes?.sourceTypes.find((st) => st.code === sourceType)?.logo}
                      alt={investmentTypes?.sourceTypes.find((st) => st.code === sourceType)?.label}
                      className="h-5 w-5 object-contain"
                    />
                  ) : (
                    <TrendingUp className="h-4.5 w-4.5 text-primary" />
                  )
                ) : (
                  <Building2 className="h-4.5 w-4.5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">
                  {documentType === 'investment_statement'
                    ? investmentTypes?.sourceTypes.find((st) => st.code === sourceType)?.label ||
                      'Investment Statement'
                    : 'Bank / Credit Card Statement'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {documentType === 'investment_statement'
                    ? 'Holdings will be extracted'
                    : 'Transactions & balances will be extracted'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={goToPrevStep}
                className="text-xs h-7 px-2"
              >
                Change
              </Button>
            </div>

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
                accept=".pdf,.csv,.xls,.xlsx"
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
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF, CSV, or Excel • Max 10MB
                  </p>
                </div>
              )}
            </div>

            {/* Bank statement account selector */}
            {documentType === 'bank_statement' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Link to Account</Label>
                <AccountSelector
                  accounts={accounts || []}
                  value={accountId === 'auto' ? null : accountId}
                  onValueChange={(id) => setAccountId(id || 'auto')}
                  mode="single"
                  showAllOption
                  allOptionLabel="Auto-detect from statement"
                  triggerClassName="w-full h-10"
                />
              </div>
            )}

            {/* Password section */}
            {hasPasswordProtectableFiles && (showPasswordField || !hasSavedPassword) && (
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
                {password && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={savePassword}
                      onChange={(e) => setSavePassword(e.target.checked)}
                      className="rounded border-input"
                    />
                    <span className="text-muted-foreground text-xs">Remember for this account</span>
                  </label>
                )}
              </div>
            )}

            {hasPasswordProtectableFiles && hasSavedPassword && !showPasswordField && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">Saved password will be used</span>
              </div>
            )}

            {/* AI Models - Always visible */}
            <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/50">
              <Label className="text-sm font-medium">AI Models</Label>

              {configuredProviders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No AI providers configured. Please configure one in settings.
                </p>
              ) : (
                <div
                  className={cn(
                    'grid gap-3',
                    documentType === 'bank_statement' ? 'grid-cols-2' : 'grid-cols-1'
                  )}
                >
                  {/* Parsing model */}
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

                  {/* Categorization model - only for bank statements */}
                  {documentType === 'bank_statement' && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Categorization</Label>
                      <Select
                        value={categorizationModelValue}
                        onValueChange={handleCategorizationModelChange}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select model">
                            {categorizationModelValue &&
                              (() => {
                                const { providerData, modelData } =
                                  findModelInfo(categorizationModelValue)
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
                            if (provider.models.length === 0) return null
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
                                {provider.models.map((model) => (
                                  <SelectItem
                                    key={`${provider.code}:${model.id}`}
                                    value={`${provider.code}:${model.id}`}
                                  >
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
                              </SelectGroup>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Categorization hints - only for bank statements */}
            {documentType === 'bank_statement' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Categorization Hints (Optional)</Label>
                <Textarea
                  placeholder="E.g., FX transactions are investments, not transfers"
                  value={categorizationHints}
                  onChange={(e) => setCategorizationHints(e.target.value.slice(0, 1000))}
                  className="min-h-[80px] resize-none"
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  Help the AI categorize your transactions better with custom rules.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border/50 bg-surface-elevated shrink-0">
        <div className="flex items-center justify-between">
          <div>
            {currentStep !== 'type' && (
              <Button
                type="button"
                variant="ghost"
                onClick={goToPrevStep}
                disabled={isUploading}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
            {currentStep === 'upload' && (
              <Button
                type="submit"
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
                    {files.length > 1 ? `Upload ${files.length} Files` : 'Upload Statement'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
