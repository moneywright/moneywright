import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Copy, Check, AlertCircle, Database, KeyRound, LayoutDashboard } from 'lucide-react'
import { AuthLayout } from '@/components/auth/auth-layout'
import { PinInput } from '@/components/ui/pin-input'
import { Button } from '@/components/ui/button'
import { setupPin } from '@/lib/api'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/pin/setup')({
  component: PinSetupPage,
})

const STEPS = [
  { id: 'create', label: 'Create PIN' },
  { id: 'confirm', label: 'Confirm PIN' },
  { id: 'backup', label: 'Save Backup' },
]

function PinSetupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'create' | 'confirm' | 'backup'>('create')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const setupMutation = useMutation({
    mutationFn: (pin: string) => setupPin(pin),
    onSuccess: (data) => {
      setBackupCode(data.backupCode)
      setStep('backup')
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Failed to setup PIN')
    },
  })

  const handlePinComplete = (value: string) => {
    if (step === 'create') {
      setPin(value)
      setStep('confirm')
      setConfirmPin('')
    } else if (step === 'confirm') {
      if (value === pin) {
        setError('')
        setupMutation.mutate(value)
      } else {
        setError('PINs do not match')
        setConfirmPin('')
      }
    }
  }

  const handleCopyBackupCode = async () => {
    await navigator.clipboard.writeText(backupCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContinue = () => {
    // Navigate to the app (setup/onboarding will handle the rest)
    navigate({ to: '/' })
  }

  const currentStepIndex = step === 'create' ? 1 : step === 'confirm' ? 2 : 3

  return (
    <AuthLayout
      currentStep={currentStepIndex}
      steps={STEPS}
      title="Welcome to"
      subtitle="Moneywright"
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
        key={step}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {step === 'create' && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-white font-display">Create your PIN</h2>
              <p className="text-zinc-400 text-sm">Enter a 6-digit PIN to secure your app</p>
            </div>

            <div className="py-4">
              <PinInput value={pin} onChange={setPin} onComplete={handlePinComplete} autoFocus />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-white font-display">Confirm your PIN</h2>
              <p className="text-zinc-400 text-sm">Enter your PIN again to confirm</p>
            </div>

            <div className="py-4">
              <PinInput
                value={confirmPin}
                onChange={(value) => {
                  setConfirmPin(value)
                  setError('')
                }}
                onComplete={handlePinComplete}
                error={!!error}
                autoFocus
              />
            </div>

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
                setStep('create')
                setPin('')
                setConfirmPin('')
                setError('')
              }}
            >
              Start over
            </Button>
          </>
        )}

        {step === 'backup' && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-white font-display">
                Save your backup code
              </h2>
              <p className="text-zinc-400 text-sm">
                Save this code somewhere safe. You'll need it if you forget your PIN.
              </p>
            </div>

            <div className="py-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <code className="text-xl font-mono text-emerald-400 tracking-wider">
                    {backupCode}
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
                We recommend saving this in your email or a secure password manager
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
                I have saved my backup code in a safe place
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
