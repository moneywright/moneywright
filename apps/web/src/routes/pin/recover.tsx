import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { KeyRound, Copy, Check, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { AuthLayout } from '@/components/auth/auth-layout'
import { PinInput } from '@/components/ui/pin-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { recoverPin } from '@/lib/api'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/pin/recover')({
  component: PinRecoverPage,
})

function PinRecoverPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'backup' | 'newpin' | 'confirm' | 'done'>('backup')
  const [backupCode, setBackupCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [newBackupCode, setNewBackupCode] = useState('')
  const [error, setError] = useState('')
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  // Countdown timer for lockout
  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      const timer = setInterval(() => {
        setRetryAfter((prev) => {
          if (prev && prev > 1) return prev - 1
          return null
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [retryAfter])

  const recoverMutation = useMutation({
    mutationFn: ({ backupCode, newPin }: { backupCode: string; newPin: string }) =>
      recoverPin(backupCode, newPin),
    onSuccess: (result) => {
      if (result.success && 'backupCode' in result) {
        setNewBackupCode(result.backupCode)
        setStep('done')
      } else if (!result.success) {
        setError(
          result.error === 'too_many_attempts'
            ? 'Too many attempts'
            : result.error === 'invalid_backup_code'
              ? 'Invalid backup code'
              : 'Recovery failed'
        )
        if ('retryAfter' in result && result.retryAfter) {
          setRetryAfter(result.retryAfter)
        }
        // Go back to backup code step on error
        setStep('backup')
      }
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Failed to recover PIN')
      setStep('backup')
    },
  })

  const handleBackupSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!backupCode.trim()) {
      setError('Please enter your backup code')
      return
    }
    setError('')
    setStep('newpin')
  }

  const handleNewPinComplete = (value: string) => {
    setNewPin(value)
    setStep('confirm')
    setConfirmPin('')
  }

  const handleConfirmPinComplete = (value: string) => {
    if (value === newPin) {
      setError('')
      recoverMutation.mutate({ backupCode: backupCode.trim(), newPin: value })
    } else {
      setError('PINs do not match')
      setConfirmPin('')
    }
  }

  const handleCopyBackupCode = async () => {
    await navigator.clipboard.writeText(newBackupCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContinue = () => {
    navigate({ to: '/' })
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    return `${secs}s`
  }

  const isLocked = retryAfter !== null && retryAfter > 0

  return (
    <AuthLayout
      title="Reset your"
      subtitle="PIN"
      description="Use your backup code to reset your PIN. You saved this code when you first set up your PIN."
      features={[
        {
          icon: <KeyRound className="w-4 h-4" />,
          title: 'Backup Code Recovery',
          description: 'Enter the 12-character code you saved earlier',
        },
        {
          icon: <KeyRound className="w-4 h-4" />,
          title: 'New PIN',
          description: "You'll create a new 6-digit PIN",
        },
        {
          icon: <KeyRound className="w-4 h-4" />,
          title: 'New Backup Code',
          description: "We'll give you a new backup code to save",
        },
      ]}
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {step === 'backup' && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-white font-display">Enter backup code</h2>
              <p className="text-zinc-400 text-sm">
                Enter the 12-character backup code you saved when setting up your PIN
              </p>
            </div>

            <form onSubmit={handleBackupSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backup-code" className="text-zinc-400">
                  Backup Code
                </Label>
                <Input
                  id="backup-code"
                  type="text"
                  placeholder="XXXX-XXXX-XXXX"
                  value={backupCode}
                  onChange={(e) => {
                    setBackupCode(e.target.value.toUpperCase())
                    setError('')
                  }}
                  disabled={isLocked}
                  className={cn(
                    'font-mono text-center text-lg tracking-wider',
                    'bg-zinc-900/50 border-zinc-800 focus:border-emerald-500',
                    error && 'border-red-500/50'
                  )}
                />
              </div>

              {error && !isLocked && (
                <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {isLocked && (
                <div className="text-center space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 text-sm justify-center">
                    <AlertCircle className="w-4 h-4" />
                    <span>Too many failed attempts</span>
                  </div>
                  <p className="text-zinc-400 text-sm">
                    Please wait{' '}
                    <span className="font-mono text-amber-400">{formatTime(retryAfter)}</span>{' '}
                    before trying again
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                disabled={isLocked || !backupCode.trim()}
              >
                Continue
              </Button>
            </form>

            <div className="pt-2 text-center">
              <Link
                to="/pin/unlock"
                className="text-sm text-zinc-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to PIN entry
              </Link>
            </div>
          </>
        )}

        {step === 'newpin' && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-white font-display">Create new PIN</h2>
              <p className="text-zinc-400 text-sm">Enter a new 6-digit PIN</p>
            </div>

            <div className="py-4">
              <PinInput
                value={newPin}
                onChange={setNewPin}
                onComplete={handleNewPinComplete}
                autoFocus
              />
            </div>

            <Button
              variant="ghost"
              className="w-full text-zinc-400 hover:text-white"
              onClick={() => {
                setStep('backup')
                setNewPin('')
              }}
            >
              Back
            </Button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-white font-display">Confirm new PIN</h2>
              <p className="text-zinc-400 text-sm">Enter your new PIN again to confirm</p>
            </div>

            <div className="py-4">
              <PinInput
                value={confirmPin}
                onChange={(value) => {
                  setConfirmPin(value)
                  setError('')
                }}
                onComplete={handleConfirmPinComplete}
                error={!!error}
                disabled={recoverMutation.isPending}
                autoFocus
              />
            </div>

            {recoverMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Resetting PIN...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <Button
              variant="ghost"
              className="w-full text-zinc-400 hover:text-white"
              onClick={() => {
                setStep('newpin')
                setNewPin('')
                setConfirmPin('')
                setError('')
              }}
            >
              Start over
            </Button>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-white font-display">PIN Reset!</h2>
              <p className="text-zinc-400 text-sm">
                Your PIN has been reset. Save your new backup code below.
              </p>
            </div>

            <div className="py-2">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <code className="text-xl font-mono text-emerald-400 tracking-wider">
                    {newBackupCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyBackupCode}
                    className="text-zinc-400 hover:text-white"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2 text-center">
                Your old backup code is now invalid
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className={cn(
                    'w-5 h-5 border-2 rounded transition-all duration-200',
                    confirmed
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-zinc-600 group-hover:border-zinc-500'
                  )}
                >
                  {confirmed && <Check className="w-4 h-4 text-white absolute top-0.5 left-0.5" />}
                </div>
              </div>
              <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                I have saved my new backup code
              </span>
            </label>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={handleContinue}
              disabled={!confirmed}
            >
              Continue to App
            </Button>
          </>
        )}
      </motion.div>
    </AuthLayout>
  )
}
