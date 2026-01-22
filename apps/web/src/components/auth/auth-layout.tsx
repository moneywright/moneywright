import { cn } from '@/lib/utils'
import { motion } from 'motion/react'

export interface AuthStep {
  id: string
  label: string
}

interface AuthLayoutProps {
  children: React.ReactNode
  /** Current step index (1-based) */
  currentStep?: number
  /** Array of step definitions */
  steps?: AuthStep[]
  /** Custom title for the left panel */
  title?: string
  /** Custom subtitle for the left panel */
  subtitle?: string
}

export function AuthLayout({
  children,
  currentStep,
  steps,
  title = 'Your finances,',
  subtitle = 'simplified',
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-[#030303] font-body">
      {/* Left Panel - Branding (exactly 50%) */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-8 xl:p-12 relative overflow-hidden">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0">
          {/* Base dark gradient */}
          <div className="absolute inset-0 bg-linear-to-br from-[#030303] via-[#0a0f0d] to-[#030303]" />

          {/* Floating orbs */}
          <motion.div
            className="absolute -top-32 -left-32 w-150 h-150 rounded-full opacity-40"
            style={{
              background:
                'radial-gradient(circle at center, rgba(16, 185, 129, 0.15) 0%, transparent 60%)',
            }}
            animate={{
              x: [0, 50, 0],
              y: [0, 30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute -bottom-48 -right-48 w-175 h-175 rounded-full opacity-30"
            style={{
              background:
                'radial-gradient(circle at center, rgba(20, 184, 166, 0.12) 0%, transparent 55%)',
            }}
            animate={{
              x: [0, -40, 0],
              y: [0, -50, 0],
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute top-1/2 left-1/3 w-100 h-100 rounded-full opacity-20"
            style={{
              background:
                'radial-gradient(circle at center, rgba(52, 211, 153, 0.1) 0%, transparent 50%)',
            }}
            animate={{
              x: [0, 30, -20, 0],
              y: [0, -40, 20, 0],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
              `,
              backgroundSize: '80px 80px',
            }}
          />

          {/* Noise texture */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Logo */}
        <motion.div
          className="relative z-10 flex items-center gap-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
            <img src="/logo.png" alt="Moneywright" className="relative h-10 w-10" />
          </div>
          <span className="text-lg font-medium text-white/90 tracking-tight font-display">
            Moneywright
          </span>
        </motion.div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-start justify-center flex-1 max-w-md mx-auto w-full">
          {/* Decorative line */}
          <motion.div
            className="w-12 h-px bg-linear-to-r from-emerald-500/50 to-transparent mb-8"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-display text-[3.5rem] xl:text-[4rem] font-semibold text-white leading-[1.05] tracking-tight">
              {title}
              <br />
              <span className="bg-linear-to-r from-emerald-400 via-teal-400 to-emerald-300 bg-clip-text text-transparent">
                {subtitle}
              </span>
            </h1>
          </motion.div>

          <motion.p
            className="mt-6 text-zinc-500 text-base leading-relaxed max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            AI-powered insights to track expenses, analyze investments, and grow your wealth.
          </motion.p>

          {/* Feature pills */}
          <motion.div
            className="flex flex-wrap gap-2 mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {['Smart Categorization', 'Multi-Currency', 'Family Profiles'].map((feature, i) => (
              <motion.span
                key={feature}
                className="px-3 py-1.5 text-xs font-medium text-emerald-400/80 bg-emerald-500/10 rounded-full border border-emerald-500/20"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
              >
                {feature}
              </motion.span>
            ))}
          </motion.div>
        </div>

        {/* Step indicators at bottom */}
        {steps && steps.length > 0 && currentStep !== undefined && (
          <motion.div
            className="relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <StepProgress steps={steps} currentStep={currentStep} />
          </motion.div>
        )}
      </div>

      {/* Right Panel - Form (exactly 50%) */}
      <div className="w-full lg:w-1/2 flex flex-col min-h-screen relative bg-[#0a0a0a]">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-emerald-950/5 pointer-events-none" />

        {/* Border glow effect */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-linear-to-b from-transparent via-emerald-500/20 to-transparent hidden lg:block" />

        {/* Mobile header */}
        <div className="lg:hidden p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Moneywright" className="h-8 w-8" />
            <span className="text-white font-medium font-display">Moneywright</span>
          </div>
          {steps && steps.length > 0 && currentStep !== undefined && (
            <MobileStepIndicator steps={steps} currentStep={currentStep} />
          )}
        </div>

        {/* Form content - centered */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 xl:p-16">
          <div className="w-full max-w-105">{children}</div>
        </div>
      </div>
    </div>
  )
}

interface StepProgressProps {
  steps: AuthStep[]
  currentStep: number
}

function StepProgress({ steps, currentStep }: StepProgressProps) {
  return (
    <div className="flex items-center gap-6">
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const isActive = stepNumber === currentStep
        const isCompleted = stepNumber < currentStep

        return (
          <div key={step.id} className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              {/* Step circle */}
              <div
                className={cn(
                  'relative flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium transition-all duration-500 font-display',
                  isActive && 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
                  isCompleted && 'bg-emerald-500/20 text-emerald-400',
                  !isActive && !isCompleted && 'bg-zinc-800/50 text-zinc-600'
                )}
              >
                {isCompleted ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNumber
                )}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-emerald-400/50"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}
              </div>

              {/* Step label */}
              <span
                className={cn(
                  'text-sm font-medium transition-colors duration-300',
                  isActive && 'text-white',
                  isCompleted && 'text-emerald-400/70',
                  !isActive && !isCompleted && 'text-zinc-600'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="relative w-12 h-0.5 overflow-hidden rounded-full bg-zinc-800/50">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-linear-to-r from-emerald-500 to-teal-500"
                  initial={{ width: 0 }}
                  animate={{
                    width: isCompleted ? '100%' : '0%',
                  }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface MobileStepIndicatorProps {
  steps: AuthStep[]
  currentStep: number
}

function MobileStepIndicator({ steps, currentStep }: MobileStepIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const isActive = stepNumber === currentStep
        const isCompleted = stepNumber < currentStep

        return (
          <div
            key={step.id}
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              isActive && 'w-8 bg-emerald-500',
              isCompleted && 'w-1.5 bg-emerald-500/50',
              !isActive && !isCompleted && 'w-1.5 bg-zinc-700'
            )}
          />
        )
      })}
    </div>
  )
}
