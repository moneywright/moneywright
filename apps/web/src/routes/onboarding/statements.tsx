import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import {
  Loader2,
  ArrowRight,
  Upload,
  FileText,
  X,
  Building2,
  TrendingUp,
  Receipt,
  PieChart,
  Lock,
  AlertCircle,
  Check,
} from 'lucide-react'
import { useCategorizationStatus } from '@/hooks'
import { cn } from '@/lib/utils'
import { AuthLayout, type AuthStep } from '@/components/auth/auth-layout'
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
import {
  getProfiles,
  getInvestmentTypes,
  getLLMProviders,
  getPreferences,
  setPreference,
  uploadStatements,
  PREFERENCE_KEYS,
} from '@/lib/api'
import { PROVIDER_LOGOS, getLogoInvertStyle } from '@/lib/provider-logos'
import { toast } from 'sonner'

export const Route = createFileRoute('/onboarding/statements')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || undefined,
  }),
  component: StatementsUploadPage,
})

// Step definitions for AuthLayout
const ONBOARDING_STEPS: AuthStep[] = [
  { id: 'country', label: 'Country' },
  { id: 'profile', label: 'Profile' },
  { id: 'statements', label: 'Statements' },
]

type DocumentType = 'bank_statement' | 'investment_statement'
type WizardStep = 'type' | 'source' | 'upload'

function StatementsUploadPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { redirect: redirectTo } = Route.useSearch()

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('type')
  const [documentType, setDocumentType] = useState<DocumentType | null>(null)
  const [sourceType, setSourceType] = useState<string>('')

  // File upload state
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [hasUploadedAtLeastOne, setHasUploadedAtLeastOne] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Processing status
  const { data: processingStatus } = useCategorizationStatus()

  // AI model state
  const [parsingModelValue, setParsingModelValue] = useState<string>('')
  const [categorizationModelValue, setCategorizationModelValue] = useState<string>('')
  const [categorizationHints, setCategorizationHints] = useState<string>('')

  // Password state
  const [password, setPassword] = useState('')
  const [savePassword, setSavePassword] = useState(true)
  const [showPasswordField, setShowPasswordField] = useState(false)

  // Get the default profile
  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
  })

  const defaultProfile = profiles?.[0]

  // Get investment types for source selection
  const { data: investmentTypes } = useQuery({
    queryKey: ['investment-types'],
    queryFn: getInvestmentTypes,
  })

  // Get LLM providers
  const { data: providers } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: getLLMProviders,
  })

  // Get preferences
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

  const hasPasswordProtectableFiles = files.some((f) => {
    const name = f.name.toLowerCase()
    return name.endsWith('.pdf') || name.endsWith('.xlsx') || name.endsWith('.xls')
  })

  const handleUpload = async () => {
    if (!defaultProfile || files.length === 0 || !documentType) return

    setIsUploading(true)
    setError(null)

    try {
      const parsing = parseModelValue(parsingModelValue)
      const categorization = parseModelValue(categorizationModelValue)

      const result = await uploadStatements(files, defaultProfile.id, {
        documentType,
        sourceType: documentType === 'investment_statement' ? sourceType : undefined,
        password: password || undefined,
        savePassword: password ? savePassword : undefined,
        parsingProvider: parsing.provider || undefined,
        parsingModel: parsing.model || undefined,
        categorizationProvider: categorization.provider || undefined,
        categorizationModel: categorization.model || undefined,
        categorizationHints: categorizationHints.trim() || undefined,
      })

      const successCount = result.processedCount
      const failCount = result.errors?.length || 0

      if (successCount > 0) {
        // Show success state on button
        setUploadSuccess(true)
        setHasUploadedAtLeastOne(true)

        // Invalidate queries to trigger processing status
        queryClient.invalidateQueries({ queryKey: ['categorization-status'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['accounts'] })
        queryClient.invalidateQueries({ queryKey: ['investments'] })

        // After showing success, reset to type selection for more uploads
        setTimeout(() => {
          setUploadSuccess(false)
          setFiles([])
          setPassword('')
          setSavePassword(true)
          setShowPasswordField(false)
          setDocumentType(null)
          setSourceType('')
          setCategorizationHints('')
          setCurrentStep('type')
        }, 1500)

        if (failCount > 0) {
          toast.success(
            `${successCount} statement${successCount !== 1 ? 's' : ''} uploaded, ${failCount} failed`
          )
        }
      } else {
        setError('Failed to upload statements')
      }
    } catch (err: unknown) {
      const error = err as Error & {
        response?: {
          data?: {
            passwordRequired?: boolean
            message?: string
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

  const handleSkip = () => {
    navigate({ to: redirectTo || '/', replace: true })
  }

  const goToPrevStep = () => {
    if (currentStep === 'upload') {
      setFiles([])
      setPassword('')
      setShowPasswordField(false)
      setError(null)
      if (documentType === 'investment_statement') {
        setCurrentStep('source')
      } else {
        setCurrentStep('type')
        setDocumentType(null)
      }
    } else if (currentStep === 'source') {
      setCurrentStep('type')
      setDocumentType(null)
      setSourceType('')
    }
  }

  return (
    <AuthLayout
      currentStep={3}
      steps={ONBOARDING_STEPS}
      title="Upload your"
      subtitle="statements"
      description="Import your bank statements, credit card bills, and investment reports to get started with tracking your finances."
      features={[
        {
          icon: <Receipt className="w-4 h-4" />,
          title: 'Any Format',
          description: 'Upload PDF, Excel, or CSV statements from any bank or broker',
        },
        {
          icon: <TrendingUp className="w-4 h-4" />,
          title: 'Auto Tracking',
          description: 'Automatically tracks your net worth, income, and expenses',
        },
        {
          icon: <PieChart className="w-4 h-4" />,
          title: 'Instant Insights',
          description: 'Get spending breakdowns and trends immediately',
        },
      ]}
    >
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="mb-6">
          <motion.h1
            className="text-2xl font-semibold text-white tracking-tight font-display mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {currentStep === 'type' &&
              (hasUploadedAtLeastOne ? 'Upload more statements' : 'Upload your first statement')}
            {currentStep === 'source' && 'Select investment platform'}
            {currentStep === 'upload' && 'Drop your files'}
          </motion.h1>
          <motion.p
            className="text-zinc-500 text-[15px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {currentStep === 'type' &&
              (hasUploadedAtLeastOne
                ? 'Add another statement or continue to dashboard'
                : 'Choose the type of statement to import')}
            {currentStep === 'source' && 'We support most major brokers and platforms'}
            {currentStep === 'upload' && 'PDF, CSV, or Excel files supported'}
          </motion.p>
        </div>

        {/* Processing Status - Fixed position in top right of viewport (right half) */}
        <AnimatePresence>
          {processingStatus?.active && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-6 right-6 z-50"
            >
              <div className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-emerald-500/30 text-sm font-medium text-emerald-400 overflow-hidden shadow-lg">
                {/* Shimmer effect */}
                <div className="absolute inset-0 animate-shimmer-slide bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

                {/* Blinking dot */}
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>

                {/* Text */}
                <span className="relative">
                  {processingStatus.type === 'parsing' &&
                    (processingStatus.progress
                      ? `Parsing ${processingStatus.progress.current}/${processingStatus.progress.total}`
                      : 'Parsing...')}
                  {processingStatus.type === 'categorizing' && 'Categorizing...'}
                  {!['parsing', 'categorizing'].includes(processingStatus.type || '') &&
                    'Processing...'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Type Selection */}
        {currentStep === 'type' && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {/* Success indicator when returning after upload */}
            {hasUploadedAtLeastOne && !processingStatus?.active && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400"
              >
                <Check className="w-4 h-4" />
                <span>Statement uploaded successfully!</span>
              </motion.div>
            )}

            <button
              type="button"
              onClick={() => {
                setDocumentType('bank_statement')
                setCurrentStep('upload')
              }}
              className="group w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all text-left"
            >
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-zinc-800/80 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 border border-transparent transition-colors">
                <Building2 className="h-6 w-6 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Bank / Credit Card</p>
                <p className="text-sm text-zinc-500">Extract transactions & balances</p>
              </div>
              <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
            </button>

            <button
              type="button"
              onClick={() => {
                setDocumentType('investment_statement')
                setCurrentStep('source')
              }}
              className="group w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all text-left"
            >
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-zinc-800/80 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 border border-transparent transition-colors">
                <TrendingUp className="h-6 w-6 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Investment</p>
                <p className="text-sm text-zinc-500">Import holdings & portfolio</p>
              </div>
              <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
            </button>

            <p className="text-xs text-zinc-600 text-center pt-2">
              Supported formats: PDF, CSV, Excel (.xlsx, .xls)
            </p>
          </motion.div>
        )}

        {/* Step 2: Source Selection (Investment only) */}
        {currentStep === 'source' && (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="grid grid-cols-3 gap-2">
              {investmentTypes?.sourceTypes.map((st) => (
                <button
                  key={st.code}
                  type="button"
                  onClick={() => {
                    setSourceType(st.code)
                    setCurrentStep('upload')
                  }}
                  className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all"
                >
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-zinc-800/80 overflow-hidden">
                    {st.logo ? (
                      <img src={st.logo} alt={st.label} className="h-6 w-6 object-contain" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-zinc-400" />
                    )}
                  </div>
                  <span className="text-xs font-medium text-zinc-300 text-center">{st.label}</span>
                </button>
              ))}
            </div>

            <Button
              onClick={goToPrevStep}
              variant="ghost"
              className="w-full h-10 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
            >
              Back
            </Button>
          </motion.div>
        )}

        {/* Step 3: Upload */}
        {currentStep === 'upload' && (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {/* Selected type indicator */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-emerald-500/10 shrink-0">
                {documentType === 'investment_statement' ? (
                  investmentTypes?.sourceTypes.find((st) => st.code === sourceType)?.logo ? (
                    <img
                      src={investmentTypes?.sourceTypes.find((st) => st.code === sourceType)?.logo}
                      alt=""
                      className="h-5 w-5 object-contain"
                    />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  )
                ) : (
                  <Building2 className="h-4 w-4 text-emerald-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-white">
                  {documentType === 'investment_statement'
                    ? investmentTypes?.sourceTypes.find((st) => st.code === sourceType)?.label ||
                      'Investment'
                    : 'Bank / Credit Card'}
                </p>
              </div>
              <button
                type="button"
                onClick={goToPrevStep}
                className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                Change
              </button>
            </div>

            {/* Drop zone */}
            <div
              className={cn(
                'relative rounded-xl transition-all duration-200 cursor-pointer border-2 border-dashed',
                dragActive
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : files.length > 0
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/50'
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
                  <div className="max-h-28 overflow-y-auto space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800"
                      >
                        <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-white truncate">{file.name}</p>
                          <p className="text-xs text-zinc-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="w-full py-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center justify-center gap-2 rounded-lg hover:bg-emerald-500/5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Add more files
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-3">
                    <Upload className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">Drop your files here</p>
                  <p className="text-sm text-zinc-500">
                    or{' '}
                    <span className="text-emerald-400 cursor-pointer hover:underline">browse</span>
                  </p>
                </div>
              )}
            </div>

            {/* Password section */}
            {hasPasswordProtectableFiles && (
              <div
                className={cn(
                  'space-y-2.5 p-3 rounded-xl border',
                  showPasswordField
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-zinc-900/30 border-zinc-800/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <Lock
                    className={cn(
                      'h-4 w-4',
                      showPasswordField ? 'text-amber-500' : 'text-zinc-500'
                    )}
                  />
                  <Label className="text-sm font-medium text-zinc-300">
                    File Password
                    {!showPasswordField && (
                      <span className="text-zinc-600 font-normal ml-1">(optional)</span>
                    )}
                  </Label>
                </div>
                <Input
                  type="password"
                  placeholder="Enter password if file is protected"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600"
                />
                {password && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={savePassword}
                      onChange={(e) => setSavePassword(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20"
                    />
                    <span className="text-xs text-zinc-400">
                      Remember password for this account
                    </span>
                  </label>
                )}
                <p className="text-xs text-zinc-600">
                  If your files have different passwords, upload them one at a time
                </p>
              </div>
            )}

            {/* AI Models */}
            <div className="space-y-2 p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
              <Label className="text-sm font-medium text-zinc-300">AI Models</Label>

              {configuredProviders.length === 0 ? (
                <p className="text-sm text-zinc-500">No AI providers configured.</p>
              ) : (
                <div
                  className={cn(
                    'grid gap-3',
                    documentType === 'bank_statement' ? 'grid-cols-2' : 'grid-cols-1'
                  )}
                >
                  {/* Parsing model */}
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">Parsing</Label>
                    <Select value={parsingModelValue} onValueChange={handleParsingModelChange}>
                      <SelectTrigger className="h-9 bg-zinc-900/50 border-zinc-800 text-white">
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
                                      <span className="text-[10px] uppercase tracking-wide font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
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
                      <Label className="text-xs text-zinc-500">Categorization</Label>
                      <Select
                        value={categorizationModelValue}
                        onValueChange={handleCategorizationModelChange}
                      >
                        <SelectTrigger className="h-9 bg-zinc-900/50 border-zinc-800 text-white">
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
                                        <span className="text-[10px] uppercase tracking-wide font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
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
              <div className="space-y-2 p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                <Label className="text-sm font-medium text-zinc-300">
                  Categorization Hints (Optional)
                </Label>
                <Textarea
                  placeholder="E.g., FX transactions are investments, not transfers"
                  value={categorizationHints}
                  onChange={(e) => setCategorizationHints(e.target.value.slice(0, 1000))}
                  className="min-h-[80px] resize-none bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600"
                  maxLength={1000}
                />
                <p className="text-xs text-zinc-600">
                  Help the AI categorize your transactions better with custom rules.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          className="mt-6 space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          {currentStep === 'upload' && files.length > 0 && (
            <Button
              onClick={handleUpload}
              disabled={isUploading || uploadSuccess}
              className={cn(
                'w-full h-12 rounded-xl text-[15px] font-medium text-white shadow-lg shadow-emerald-500/25 transition-none',
                uploadSuccess
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110'
              )}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : uploadSuccess ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Uploaded!
                </motion.span>
              ) : (
                <>
                  Upload {files.length > 1 ? `${files.length} Files` : 'Statement'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}

          {(currentStep === 'type' || (currentStep === 'upload' && files.length === 0)) &&
            hasUploadedAtLeastOne && (
              <Button
                onClick={handleSkip}
                className="w-full h-12 rounded-xl text-[15px] font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition-none hover:brightness-110"
              >
                Continue to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

          {(currentStep === 'type' || (currentStep === 'upload' && files.length === 0)) &&
            !hasUploadedAtLeastOne && (
              <Button
                onClick={handleSkip}
                variant="ghost"
                className="w-full h-12 rounded-xl text-[15px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all duration-300"
              >
                Skip for now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

          {currentStep === 'upload' && files.length === 0 && (
            <Button
              onClick={goToPrevStep}
              variant="ghost"
              className="w-full h-10 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
            >
              Back
            </Button>
          )}
        </motion.div>

        {/* Footer note */}
        <motion.p
          className="mt-4 text-center text-xs text-zinc-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          You can always upload more statements later
        </motion.p>
      </motion.div>
    </AuthLayout>
  )
}
