import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Lock, AlertCircle, Loader2, Database, KeyRound, LayoutDashboard } from 'lucide-react'
import { AuthLayout } from '@/components/auth/auth-layout'
import { PinInput } from '@/components/ui/pin-input'
import { Button } from '@/components/ui/button'
import { verifyPin } from '@/lib/api'

export const Route = createFileRoute('/pin/unlock')({
  component: PinUnlockPage,
})

function PinUnlockPage() {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

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

  const verifyMutation = useMutation({
    mutationFn: (pin: string) => verifyPin(pin),
    onSuccess: (result) => {
      if (result.success) {
        // Navigate to the app
        navigate({ to: '/' })
      } else {
        setError(
          result.error === 'too_many_attempts'
            ? 'Too many attempts'
            : result.error === 'invalid_pin'
              ? 'Incorrect PIN'
              : 'Verification failed'
        )
        if (result.retryAfter) {
          setRetryAfter(result.retryAfter)
        }
        if (result.attemptsRemaining !== undefined) {
          setAttemptsRemaining(result.attemptsRemaining)
        }
        setPin('')
      }
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Failed to verify PIN')
      setPin('')
    },
  })

  const handlePinComplete = (value: string) => {
    if (retryAfter) return
    setError('')
    verifyMutation.mutate(value)
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
      title="Welcome back"
      subtitle="to Moneywright"
      description="Track your bank accounts, investments, loans, and insurance — all in one place, powered by AI."
      features={[
        {
          icon: <Database className="w-4 h-4" />,
          title: 'Self-Hosted',
          description: 'Runs on your machine with no account required',
        },
        {
          icon: <KeyRound className="w-4 h-4" />,
          title: 'Bring Your Own Keys',
          description: 'Use your preferred AI provider and API keys',
        },
        {
          icon: <LayoutDashboard className="w-4 h-4" />,
          title: 'Complete Overview',
          description: 'Accounts, investments, loans, and insurance in one place',
        },
      ]}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-white font-display">Enter your PIN</h2>
          <p className="text-zinc-400 text-sm">Enter your 6-digit PIN to unlock</p>
        </div>

        <div className="py-4">
          <PinInput
            value={pin}
            onChange={(value) => {
              setPin(value)
              setError('')
            }}
            onComplete={handlePinComplete}
            disabled={isLocked || verifyMutation.isPending}
            error={!!error}
            autoFocus
          />
        </div>

        {verifyMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Verifying...</span>
          </div>
        )}

        {error && !isLocked && (
          <div className="text-center space-y-1">
            <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            {attemptsRemaining !== null && attemptsRemaining > 0 && (
              <p className="text-xs text-zinc-500">
                {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining
              </p>
            )}
          </div>
        )}

        {isLocked && (
          <div className="text-center space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-sm justify-center">
              <AlertCircle className="w-4 h-4" />
              <span>Too many failed attempts</span>
            </div>
            <p className="text-zinc-400 text-sm">
              Please wait <span className="font-mono text-amber-400">{formatTime(retryAfter)}</span>{' '}
              before trying again
            </p>
          </div>
        )}

        <div className="pt-4 text-center">
          <Link
            to="/pin/recover"
            className="text-sm text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            Forgot your PIN?
          </Link>
        </div>
      </motion.div>
    </AuthLayout>
  )
}
