/**
 * PIN settings section component (local mode only)
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Lock, KeyRound, Copy, Check, AlertCircle, Loader2 } from 'lucide-react'
import { PinInput } from '@/components/ui/pin-input'
import { changePin, regenerateBackupCode } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function PinSection() {
  const [changePinOpen, setChangePinOpen] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)

  return (
    <Card className="border-border-subtle hover:border-border-hover transition-colors animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Security
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border-subtle">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">PIN</p>
              <p className="text-sm font-medium text-muted-foreground">******</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setChangePinOpen(true)}>
              Change
            </Button>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border-subtle">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Backup Code</p>
              <p className="text-sm font-medium text-muted-foreground">Hidden</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRegenerateOpen(true)}>
              Regenerate
            </Button>
          </div>
        </div>
      </CardContent>

      <ChangePinDialog open={changePinOpen} onOpenChange={setChangePinOpen} />
      <RegenerateBackupDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} />
    </Card>
  )
}

interface ChangePinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ChangePinDialog({ open, onOpenChange }: ChangePinDialogProps) {
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')

  const changeMutation = useMutation({
    mutationFn: ({ currentPin, newPin }: { currentPin: string; newPin: string }) =>
      changePin(currentPin, newPin),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('PIN changed successfully')
        handleClose()
      } else {
        setError(
          result.error === 'invalid_current_pin'
            ? 'Current PIN is incorrect'
            : 'Failed to change PIN'
        )
        setStep('current')
        setCurrentPin('')
      }
    },
    onError: () => {
      setError('Failed to change PIN')
      setStep('current')
      setCurrentPin('')
    },
  })

  const handleClose = () => {
    setStep('current')
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    setError('')
    onOpenChange(false)
  }

  const handleCurrentPinComplete = (value: string) => {
    setCurrentPin(value)
    setError('')
    setStep('new')
  }

  const handleNewPinComplete = (value: string) => {
    setNewPin(value)
    setStep('confirm')
  }

  const handleConfirmPinComplete = (value: string) => {
    if (value === newPin) {
      setError('')
      changeMutation.mutate({ currentPin, newPin: value })
    } else {
      setError('PINs do not match')
      setConfirmPin('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'current' && 'Enter Current PIN'}
            {step === 'new' && 'Enter New PIN'}
            {step === 'confirm' && 'Confirm New PIN'}
          </DialogTitle>
          <DialogDescription>
            {step === 'current' && 'Enter your current 6-digit PIN to continue'}
            {step === 'new' && 'Enter your new 6-digit PIN'}
            {step === 'confirm' && 'Enter your new PIN again to confirm'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'current' && (
            <PinInput
              value={currentPin}
              onChange={(v) => {
                setCurrentPin(v)
                setError('')
              }}
              onComplete={handleCurrentPinComplete}
              error={!!error}
              autoFocus
            />
          )}
          {step === 'new' && (
            <PinInput
              value={newPin}
              onChange={setNewPin}
              onComplete={handleNewPinComplete}
              autoFocus
            />
          )}
          {step === 'confirm' && (
            <PinInput
              value={confirmPin}
              onChange={(v) => {
                setConfirmPin(v)
                setError('')
              }}
              onComplete={handleConfirmPinComplete}
              error={!!error}
              disabled={changeMutation.isPending}
              autoFocus
            />
          )}
        </div>

        {changeMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Changing PIN...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm justify-center">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step !== 'current' && (
            <Button
              variant="ghost"
              onClick={() => {
                if (step === 'new') {
                  setStep('current')
                  setNewPin('')
                } else if (step === 'confirm') {
                  setStep('new')
                  setConfirmPin('')
                }
                setError('')
              }}
            >
              Back
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface RegenerateBackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function RegenerateBackupDialog({ open, onOpenChange }: RegenerateBackupDialogProps) {
  const [step, setStep] = useState<'pin' | 'backup'>('pin')
  const [pin, setPin] = useState('')
  const [backupCode, setBackupCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  const regenerateMutation = useMutation({
    mutationFn: (pin: string) => regenerateBackupCode(pin),
    onSuccess: (result) => {
      if (result.success) {
        setBackupCode(result.backupCode)
        setStep('backup')
        setError('')
      } else {
        setError(
          result.error === 'invalid_pin'
            ? 'Incorrect PIN'
            : result.error === 'too_many_attempts'
              ? 'Too many attempts. Try again later.'
              : 'Failed to regenerate'
        )
        setPin('')
      }
    },
    onError: () => {
      setError('Failed to regenerate backup code')
      setPin('')
    },
  })

  const handleClose = () => {
    setStep('pin')
    setPin('')
    setBackupCode(null)
    setCopied(false)
    setConfirmed(false)
    setError('')
    onOpenChange(false)
  }

  const handlePinComplete = (value: string) => {
    setError('')
    regenerateMutation.mutate(value)
  }

  const handleCopy = async () => {
    if (backupCode) {
      await navigator.clipboard.writeText(backupCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 'pin' ? 'Regenerate Backup Code' : 'New Backup Code'}</DialogTitle>
          <DialogDescription>
            {step === 'pin'
              ? 'Enter your PIN to generate a new backup code. Your old code will be invalidated.'
              : 'Save this new backup code. Your old backup code is now invalid.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'pin' && (
          <div className="flex flex-col gap-4 py-4">
            <PinInput
              value={pin}
              onChange={(v) => {
                setPin(v)
                setError('')
              }}
              onComplete={handlePinComplete}
              error={!!error}
              disabled={regenerateMutation.isPending}
              autoFocus
            />

            {regenerateMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Regenerating...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm justify-center">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === 'backup' && (
          <div className="flex flex-col gap-4 py-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <code className="text-xl font-mono text-emerald-400 tracking-wider">
                  {backupCode}
                </code>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
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
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                I have saved my new backup code
              </span>
            </label>

            <div className="flex justify-end">
              <Button onClick={handleClose} disabled={!confirmed}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
