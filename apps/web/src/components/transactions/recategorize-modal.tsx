import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  getLLMSettings,
  getLLMProviders,
  recategorizeTransactions,
  getRecategorizeJobStatus,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const CATEGORIZATION_MODEL_STORAGE_KEY = 'statements_categorization_model'

const providerLogos: Record<string, string> = {
  openai: '/openai.svg',
  anthropic: '/anthropic.svg',
  google: '/google.svg',
  ollama: '/ollama.svg',
  vercel: '/vercel.svg',
}

const invertedLogos = ['openai', 'vercel', 'ollama']

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
  /** Type of target (unused but kept for API compatibility) */
  _targetType?: 'account' | 'statement'
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
  _targetType,
  onSuccess,
}: RecategorizeModalProps) {
  const queryClient = useQueryClient()
  const [categorizationModel, setCategorizationModel] = useState<string>(() => {
    return localStorage.getItem(CATEGORIZATION_MODEL_STORAGE_KEY) || ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<
    'pending' | 'processing' | 'completed' | 'failed' | null
  >(null)
  const [jobProgress, setJobProgress] = useState<{ processed: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: llmSettings } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: getLLMSettings,
  })

  const { data: providers } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: getLLMProviders,
  })

  const currentProvider = providers?.find((p) => p.code === llmSettings?.provider)
  const availableModels = useMemo(() => currentProvider?.models || [], [currentProvider?.models])

  // Compute the effective model to use (saved, or default from available models)
  const effectiveModel = useMemo(() => {
    if (categorizationModel) {
      // Check if saved model is still valid
      const isValid = availableModels.some((m) => m.id === categorizationModel)
      if (isValid) return categorizationModel
    }
    // Fall back to recommended or first available
    const recommended = availableModels.find((m) => m.recommendedForCategorization)
    return recommended?.id || availableModels[0]?.id || ''
  }, [categorizationModel, availableModels])

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

  const handleModelChange = (modelId: string) => {
    setCategorizationModel(modelId)
    localStorage.setItem(CATEGORIZATION_MODEL_STORAGE_KEY, modelId)
  }

  const handleSubmit = async () => {
    if (!effectiveModel) {
      setError('Please select a categorization model')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await recategorizeTransactions({
        profileId,
        accountId,
        statementId,
        categorizationModel: effectiveModel,
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
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Categorization Model</Label>
                {currentProvider && (
                  <img
                    src={providerLogos[currentProvider.code]}
                    alt={currentProvider.label}
                    className={cn(
                      'h-4 w-4',
                      invertedLogos.includes(currentProvider.code) && 'invert dark:invert-0'
                    )}
                  />
                )}
              </div>

              <Select value={effectiveModel} onValueChange={handleModelChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
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

              <p className="text-xs text-muted-foreground">
                All existing categories will be replaced with new AI-generated ones.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!isProcessing && !isCompleted && !isFailed && (
            <>
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !effectiveModel}>
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
