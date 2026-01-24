import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import { Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  getLLMProviders,
  recategorizeTransactions,
  getRecategorizeJobStatus,
  getPreferences,
  setPreference,
  PREFERENCE_KEYS,
} from '@/lib/api'
import { PROVIDER_LOGOS, getLogoInvertStyle } from '@/lib/provider-logos'

interface RecategorizeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
  /** Account ID to recategorize (all transactions) */
  accountId?: string
  /** Statement ID to recategorize (transactions from this statement) */
  statementId?: string
  /** Display name for the target (account or statement name) */
  targetName: string
  /** Callback when recategorization completes */
  onSuccess?: () => void
}

export function RecategorizeModal({
  open,
  onOpenChange,
  profileId,
  accountId,
  statementId,
  targetName,
  onSuccess,
}: RecategorizeModalProps) {
  const queryClient = useQueryClient()
  // Combined provider:model value (e.g., "openai:gpt-4o")
  const [modelValue, setModelValue] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<
    'pending' | 'processing' | 'completed' | 'failed' | null
  >(null)
  const [jobProgress, setJobProgress] = useState<{ processed: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  // Initialize from preferences - this effect syncs state with async-loaded preferences
  useEffect(() => {
    if (!preferences || configuredProviders.length === 0) return

    const savedProvider = preferences[PREFERENCE_KEYS.STATEMENT_CATEGORISATION_PROVIDER]
    const savedModel = preferences[PREFERENCE_KEYS.STATEMENT_CATEGORISATION_MODEL]

    if (!modelValue) {
      if (savedProvider && savedModel) {
        const providerData = configuredProviders.find((p) => p.code === savedProvider)
        if (providerData?.models.some((m) => m.id === savedModel)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setModelValue(`${savedProvider}:${savedModel}`)
          return
        }
      }
      // If no saved preference or invalid, set a default
      for (const provider of configuredProviders) {
        if (provider.models.length > 0) {
          const recommended = provider.models.find((m) => m.recommendedForCategorization)
          const model = recommended || provider.models[0]
          if (model) {
            setModelValue(`${provider.code}:${model.id}`)
            break
          }
        }
      }
    }
  }, [preferences, configuredProviders, modelValue])

  const handleModelChange = (value: string) => {
    setModelValue(value)
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

  const resetState = useCallback(() => {
    setJobId(null)
    setJobStatus(null)
    setJobProgress(null)
    setError(null)
    setIsSubmitting(false)
  }, [])

  // Poll job status
  useEffect(() => {
    if (!jobId || jobStatus === 'completed' || jobStatus === 'failed') return

    const pollInterval = setInterval(async () => {
      try {
        const status = await getRecategorizeJobStatus(jobId)
        setJobStatus(status.status)
        if (status.transactionCount !== undefined && status.processedCount !== undefined) {
          setJobProgress({ processed: status.processedCount, total: status.transactionCount })
        }

        if (status.status === 'completed') {
          toast.success(`Recategorized ${status.transactionCount} transactions`)
          onSuccess?.()
          // Reset after a delay to show completion
          setTimeout(() => {
            onOpenChange(false)
            resetState()
          }, 1500)
        } else if (status.status === 'failed') {
          setError(status.errorMessage || 'Recategorization failed')
        }
      } catch (err) {
        console.error('Failed to poll job status:', err)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [jobId, jobStatus, onOpenChange, onSuccess, resetState])

  const handleSubmit = async () => {
    const { provider, model } = parseModelValue(modelValue)
    if (!provider || !model) {
      setError('Please select a model')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await recategorizeTransactions({
        profileId,
        accountId,
        statementId,
        categorizationProvider: provider,
        categorizationModel: model,
      })

      setJobId(result.jobId)
      setJobStatus('pending')

      // Invalidate categorization status so the processing indicator appears
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['categorization-status'] })
      }, 2000)
    } catch (err) {
      console.error('Failed to start recategorization:', err)
      setError(err instanceof Error ? err.message : 'Failed to start recategorization')
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after a small delay to avoid visual glitch
    setTimeout(resetState, 200)
  }

  const isProcessing = jobStatus === 'pending' || jobStatus === 'processing'
  const isCompleted = jobStatus === 'completed'
  const isFailed = jobStatus === 'failed'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Recategorize Transactions
          </DialogTitle>
          <DialogDescription>
            Re-run AI categorization for all transactions in{' '}
            <span className="font-medium text-foreground">{targetName}</span>. This will overwrite
            existing categories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Progress display */}
          {isProcessing && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium text-foreground">
                  {jobStatus === 'pending' ? 'Starting...' : 'Recategorizing...'}
                </p>
                {jobProgress && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {jobProgress.processed} / {jobProgress.total} transactions
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Completed display */}
          {isCompleted && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-12 w-12 rounded-full bg-positive/10 flex items-center justify-center">
                <Check className="h-6 w-6 text-positive" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Recategorization Complete</p>
                {jobProgress && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {jobProgress.total} transactions updated
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Model selection - only show when not processing */}
          {!isProcessing && !isCompleted && (
            <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
              <Label className="text-sm font-medium">Categorization Model</Label>

              {configuredProviders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No AI providers configured. Please configure one in settings.
                </p>
              ) : (
                <>
                  <Select value={modelValue} onValueChange={handleModelChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select model">
                        {modelValue &&
                          (() => {
                            const { providerData, modelData } = findModelInfo(modelValue)
                            return providerData && modelData ? (
                              <span className="flex items-center gap-2">
                                <img
                                  src={PROVIDER_LOGOS[providerData.code]}
                                  alt={providerData.label}
                                  className="h-4 w-4"
                                  style={getLogoInvertStyle(providerData.code)}
                                />
                                <span className="truncate">{modelData.name}</span>
                                {modelData.recommendedForCategorization && (
                                  <span className="text-[10px] uppercase tracking-wide font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                    Best
                                  </span>
                                )}
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

                  <p className="text-xs text-muted-foreground">
                    All existing categories will be replaced with new AI-generated ones.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!isProcessing && !isCompleted && !isFailed && (
            <>
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !modelValue}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Recategorize
                  </>
                )}
              </Button>
            </>
          )}

          {isProcessing && (
            <Button variant="ghost" onClick={handleClose}>
              Run in Background
            </Button>
          )}

          {isFailed && (
            <>
              <Button variant="ghost" onClick={handleClose}>
                Close
              </Button>
              <Button variant="outline" onClick={() => resetState()}>
                Try Again
              </Button>
            </>
          )}

          {isCompleted && <Button onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
